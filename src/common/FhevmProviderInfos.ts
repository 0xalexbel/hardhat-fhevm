import assert from "assert";
import { ethers as EthersT } from "ethers";
import { EthereumProvider, HardhatRuntimeEnvironment, HttpNetworkConfig, NetworkConfig } from "hardhat/types";
import { EXT_TFHE_LIBRARY, ZAMA_DEV_NETWORK_CONFIG, ZamaDev } from "../constants";
import { HardhatFhevmError } from "../error";
import { HardhatEthersProvider } from "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider";
import { LOCAL_FHEVM_CHAIN_ID } from "./DockerServices";
import { HardhatFhevmProviderInfos } from "../types";
import { HARDHAT_NETWORK_NAME } from "hardhat/plugins";
import { zamaComputeContractAddresses } from "./zamaContracts";
import { isDeployed } from "../utils";
import { HardhatFhevmProvider } from "./HardhatFhevmProvider";
import { LocalFhevmProvider } from "../local/LocalFhevmProvider";
import { ZamaFhevmProvider } from "../zama/ZamaFhevmProvider";
import { MockFhevmProvider } from "../mock/MockFhevmProvider";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { logDim, LogOptions } from "../log";
import { HardhatFhevmProviderType } from "./HardhatFhevmProviderType";

export type HardhatFhevmRpcMethods = {
  setBalance: string | undefined;
  setCode: string | undefined;
  mine: string | undefined;
  evmSnapshot: string | undefined;
  evmRevert: string | undefined;
};

export type HardhatFhevmProviderCapabilities = {
  /**
   * supports async decypt mechanism
   */
  supportsAsyncDecryption: boolean;
  /**
   * supports direct decryption using Private Key
   */
  supportsPkDecryption: boolean;
  /**
   * supports Zama's Gateway reencrypt mechanism
   */
  supportsGatewayDecryption: boolean;
  /**
   * supports on-chain TFHEExecutor decrypt DB
   */
  supportsOnChainDecryption: boolean;
  /**
   * supports Zama's MockFhevmCoProcessor
   */
  supportsMockDecryption: boolean;
  /**
   * supports mock fhevm
   */
  supportsMock: boolean;
};

export enum HardhatFhevmProviderState {
  Undeployed = 0,
  Deploying = 1,
  Deployed = 2,
}

export class FhevmProviderInfos {
  private readonly _hre: HardhatRuntimeEnvironment;
  private readonly _networkName: string;
  private readonly _provider: HardhatEthersProvider;
  private readonly _eth_provider: EthereumProvider;
  private readonly _url: string | undefined;
  private _chainId: number | undefined;
  private _rpcMethods: HardhatFhevmRpcMethods | undefined;
  private _providerType: HardhatFhevmProviderType | undefined;
  private _TFHEExecutorAddress: string | undefined;
  private _MockedPrecompileAddress: string | undefined;
  private _isReady: boolean;
  private _state: HardhatFhevmProviderState | undefined;
  private _mockRequested: boolean | undefined;
  private _mockOnChainDecryptionRequested: boolean | undefined;
  private _cfgMockFhevm: boolean | undefined;
  private _cfgUseOnChainFhevmMockProcessor: boolean | undefined;

  constructor(networkName: string, hre: HardhatRuntimeEnvironment) {
    this._hre = hre;
    this._provider = hre.ethers.provider;
    this._eth_provider = hre.network.provider;
    this._networkName = networkName;
    this._isReady = false;

    const keys = Object.keys(hre.config.networks);
    if (!keys.includes(networkName)) {
      throw new HardhatFhevmError(`Unknown network ${networkName}`);
    }

    //export type NetworkConfig = HardhatNetworkConfig | HttpNetworkConfig;
    const network: NetworkConfig = hre.config.networks[networkName];
    this._chainId = network.chainId;
    if ("url" in network) {
      const httpConfig: HttpNetworkConfig = network;
      this._url = httpConfig.url;
    }

    this._cfgMockFhevm = this._hre.config.networks[this._networkName].mockFhevm;
    this._cfgUseOnChainFhevmMockProcessor = this._hre.config.networks[this._networkName].useOnChainFhevmMockProcessor;
  }

  public get networkName(): string {
    return this._networkName;
  }

  /**
   * Dynamic, computed at each call.
   */
  public async isRunning(): Promise<boolean> {
    try {
      /* const network = */ await this._provider.getNetwork();
      return true;
    } catch {
      return false;
    }
  }

  public get url(): string | undefined {
    return this._url;
  }

  /**
   * Lazy, computed only once.
   */
  public async getChainId(): Promise<number> {
    if (this._chainId === undefined) {
      const cid = await this._provider.getNetwork();
      this._chainId = Number(cid.chainId);
    }
    return this._chainId;
  }

  public get isHardhat() {
    return this._networkName === HARDHAT_NETWORK_NAME;
  }

  public get isZamaNetwork() {
    return this._url === ZAMA_DEV_NETWORK_CONFIG.url;
  }

  /**
   * Lazy, computed only once.
   */
  public async isLocalNetwork(): Promise<boolean> {
    if (!this._url) {
      return false;
    }
    const u = new URL(this._url);
    if (u.hostname !== "localhost") {
      return false;
    }
    if (u.protocol !== "http:") {
      return false;
    }
    const cid = await this.getChainId();
    if (cid === LOCAL_FHEVM_CHAIN_ID) {
      return true;
    }
    return false;
  }

  /**
   * Lazy, computed only once.
   * Note: This method will be called almost instantly
   */
  public async getProviderType(): Promise<HardhatFhevmProviderType> {
    if (!this._providerType) {
      this._providerType = HardhatFhevmProviderType.Unknown;
      const pi = await this.getRpcMethods();
      if (pi.setCode === "anvil_setCode") {
        this._providerType = HardhatFhevmProviderType.Anvil;
      } else if (pi.setCode === "hardhat_setCode") {
        if (this.isHardhat) {
          this._providerType = HardhatFhevmProviderType.Hardhat;
        } else {
          this._providerType = HardhatFhevmProviderType.HardhatNode;
        }
      } else {
        if (this.isZamaNetwork) {
          this._providerType = HardhatFhevmProviderType.Zama;
        } else if (await this.isLocalNetwork()) {
          this._providerType = HardhatFhevmProviderType.Local;
        }
      }
    }
    return this._providerType;
  }

  public async getCapabilities(): Promise<HardhatFhevmProviderCapabilities> {
    const pt = await this.getProviderType();
    const supportsMock =
      pt !== HardhatFhevmProviderType.Unknown &&
      pt !== HardhatFhevmProviderType.Zama &&
      pt !== HardhatFhevmProviderType.Local;

    return {
      // Anvil does not support Zama's mock decryption using MockFhevmCoProcessor.
      supportsMockDecryption: pt !== HardhatFhevmProviderType.Unknown && pt !== HardhatFhevmProviderType.Anvil,
      supportsMock,
      supportsGatewayDecryption: pt === HardhatFhevmProviderType.Zama || pt === HardhatFhevmProviderType.Local,
      supportsPkDecryption: pt === HardhatFhevmProviderType.Local,
      supportsOnChainDecryption: supportsMock,
      supportsAsyncDecryption: pt !== HardhatFhevmProviderType.Unknown,
    };
  }

  /**
   * Lazy, computed only once.
   */
  public async getRpcMethods(): Promise<HardhatFhevmRpcMethods> {
    if (this._rpcMethods) {
      return this._rpcMethods;
    }

    const mth: HardhatFhevmRpcMethods = {
      setBalance: undefined,
      setCode: undefined,
      mine: undefined,
      evmRevert: undefined,
      evmSnapshot: undefined,
    };

    /**
     *
     * WARNING : send_ops order matters!! test hardhat first and anvil second, because anvil supports both!!
     *
     */
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const send_ops: Array<{ name: keyof HardhatFhevmProviderInfos; method: string; args: any[] }> = [
      { name: "setCode", method: "hardhat_setCode", args: [EthersT.ZeroAddress, EthersT.ZeroHash] },
      { name: "setCode", method: "anvil_setCode", args: [EthersT.ZeroAddress, EthersT.ZeroHash] },
      { name: "setBalance", method: "hardhat_setBalance", args: [EthersT.ZeroAddress, EthersT.toQuantity(1234)] },
      { name: "setBalance", method: "anvil_setBalance", args: [EthersT.ZeroAddress, EthersT.toQuantity(1234)] },
      { name: "mine", method: "hardhat_mine", args: ["0x0"] },
      { name: "mine", method: "anvil_mine", args: ["0x0"] },
    ];

    const eth_provider = this._eth_provider;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    async function checkOp(op: {
      name: keyof HardhatFhevmProviderInfos;
      method: string;
      args: any[];
    }): Promise<boolean> {
      try {
        await eth_provider.send(op.method, op.args);
        return true;
      } catch (e) {
        assert(e instanceof Error);
        assert(e.message);
        // Can't assert since error message varies from chain to chain
        // On Fhevm Local node : "the method anvil_setCode does not exist/is not available"
        // On Anvil+Hardhat : "Method anvil_setCode is not supported"
        // assert(e.message === `Method ${op.method} is not supported`, e.message);
      }
      return false;
    }

    const ok = await Promise.all(send_ops.map((op) => checkOp(op)));
    let count = 0;
    for (let i = 0; i < ok.length; ++i) {
      if (ok[i]) {
        count++;
        mth[send_ops[i].name] = send_ops[i].method;
      }
    }

    if (count > 0) {
      mth.evmRevert = "evm_revert";
      mth.evmSnapshot = "evm_snapshot";
    }

    this._rpcMethods = mth;
    return this._rpcMethods;
  }

  /**
   * Lazy, computed only once.
   */
  public async getMockedPrecompileAddress() {
    if (this._MockedPrecompileAddress === undefined) {
      const pt = await this.getProviderType();
      switch (pt) {
        case HardhatFhevmProviderType.Unknown:
        case HardhatFhevmProviderType.Local:
        case HardhatFhevmProviderType.Zama:
          this._MockedPrecompileAddress = EthersT.ZeroAddress;
          break;
        case HardhatFhevmProviderType.Hardhat:
        case HardhatFhevmProviderType.HardhatNode:
        case HardhatFhevmProviderType.Anvil:
          this._MockedPrecompileAddress = EXT_TFHE_LIBRARY;
          break;
        default:
          throw new HardhatFhevmError(`Unknown fhevm provider type ${pt}`);
      }
    }
    return this._MockedPrecompileAddress;
  }

  /**
   * Lazy, computed only once.
   */
  public async getTFHEExecutorAddress(): Promise<string> {
    if (this._TFHEExecutorAddress === undefined) {
      const pt = await this.getProviderType();
      switch (pt) {
        case HardhatFhevmProviderType.Unknown:
          this._TFHEExecutorAddress = EthersT.ZeroAddress;
          break;
        case HardhatFhevmProviderType.Local:
        case HardhatFhevmProviderType.Hardhat:
        case HardhatFhevmProviderType.HardhatNode:
        case HardhatFhevmProviderType.Anvil:
          this._TFHEExecutorAddress = zamaComputeContractAddresses(ZamaDev).TFHEExecutor;
          break;
        case HardhatFhevmProviderType.Zama:
          this._TFHEExecutorAddress = ZamaDev.contracts.TFHEExecutor.fhevmAddress;
          break;
        default:
          throw new HardhatFhevmError(`Unknown fhevm provider type ${pt}`);
      }
    }
    return this._TFHEExecutorAddress;
  }

  /**
   * Dynamic, computed at each call.
   */
  public async useMock(): Promise<boolean> {
    const state = await this.getState();
    if (state === HardhatFhevmProviderState.Deployed) {
      return await this._isRunningMock();
    }
    const requested = await this._isMockRequested();
    return requested;
  }

  /**
   * Dynamic, computed at each call.
   */
  private async _isRunningMock(): Promise<boolean> {
    try {
      const addr = await this.getMockedPrecompileAddress();
      if (addr === EthersT.ZeroAddress) {
        return false;
      }
      // Dummy call to check if using a mock db
      const deployedAddr = await isDeployed(addr, this._provider);
      return deployedAddr !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Lazy, computed only once.
   */
  private async _isMockRequested(): Promise<boolean> {
    if (this._mockRequested === undefined) {
      this._mockRequested = await this._computeMockRequested();
    }
    return this._mockRequested;
  }

  /**
   * Dynamic, computed at each call.
   */
  private async _computeMockRequested(): Promise<boolean> {
    const caps = await this.getCapabilities();
    if (!caps.supportsMock) {
      return false;
    }
    return this._cfgMockFhevm === undefined ? true : this._cfgMockFhevm;
  }

  /**
   * Dynamic, computed at each call.
   */
  public async useMockOnChainDecryption(): Promise<boolean> {
    const state = await this.getState();
    if (state === HardhatFhevmProviderState.Deployed) {
      return await this._isRunningMockOnChainDecryption();
    }
    const requested = await this._isMockOnChainDecryptionRequested();
    return requested;
  }

  /**
   * Dynamic, computed at each call.
   */
  private async _isRunningMockOnChainDecryption(): Promise<boolean> {
    try {
      const addr = await this.getTFHEExecutorAddress();
      if (addr === EthersT.ZeroAddress) {
        return false;
      }
      const dbSaveCount = await this._getExecutorDBSaveCount(addr, this._provider);
      return dbSaveCount !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Lazy, computed only once.
   */
  private async _isMockOnChainDecryptionRequested(): Promise<boolean> {
    if (this._mockOnChainDecryptionRequested === undefined) {
      this._mockOnChainDecryptionRequested = await this._computeMockOnChainDecryptionRequested();
    }

    return this._mockOnChainDecryptionRequested;
  }

  /**
   * Dynamic, computed at each call.
   */
  private async _computeMockOnChainDecryptionRequested(): Promise<boolean> {
    const caps = await this.getCapabilities();

    /**
     * If mock was disabled by the user or if the chain does not support mock fhevm
     * then de-activate on-chain TFHEExecutor DB.
     */
    const mockFhevmRequested = this._isMockRequested();
    if (!mockFhevmRequested) {
      return false;
    }

    /**
     * If the chain does support Mock fhevm but do not support Zama's standard mock decryption (using EVM CALL ops decompilation)
     * then, we must activate on-chain TFHEExecutor DB.
     * This is the case with Anvil (because Anvil does not yet support EVM CALL ops decompilation)
     */
    if (!caps.supportsMockDecryption) {
      return true;
    }

    let cfgUseOnChainFhevmMockProcessor = false;

    const pt = await this.getProviderType();
    if (this._cfgUseOnChainFhevmMockProcessor === undefined) {
      switch (pt) {
        case HardhatFhevmProviderType.Anvil:
        case HardhatFhevmProviderType.HardhatNode:
          cfgUseOnChainFhevmMockProcessor = true;
          break;
        default:
          break;
      }
    } else {
      cfgUseOnChainFhevmMockProcessor = this._cfgUseOnChainFhevmMockProcessor;
    }

    /**
     * If the two following conditions are met:
     * 1- the chain does support mock fhevm
     * 2- the user request on-chain TFHEExecutor DB (which is not the case by default)
     * we must activate on-chain TFHEExecutor DB.
     * Note: if the chain supports on-chain decryption, then it also supports mock fhevm.
     */
    return cfgUseOnChainFhevmMockProcessor && caps.supportsOnChainDecryption;
  }

  /**
   * Dynamic, computed at each call.
   */
  private async _getExecutorDBSaveCount(contract: string | EthersT.Addressable, runner: EthersT.ContractRunner) {
    const abi = [
      {
        inputs: [],
        name: "dbSaveCount",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ];
    const c = new EthersT.Contract(contract, abi, runner);
    try {
      return (await c.dbSaveCount()) as bigint;
    } catch {
      return undefined;
    }
  }

  /**
   * Helper
   */
  public async throwIfNotReady() {
    if (!(await this.isReady())) {
      throw new HardhatFhevmError(`Network ${this.networkName} is not ready`);
    }
  }

  public async isReady(): Promise<boolean> {
    return (await this.getState()) === HardhatFhevmProviderState.Deployed && this._isReady;
  }

  public setReady() {
    assert(!this._isReady);
    this._isReady = true;
    this.setState(HardhatFhevmProviderState.Deployed);
  }

  /**
   * Helper
   */
  public async throwIfNotState(expectedState: HardhatFhevmProviderState) {
    if ((await this.getState()) !== expectedState) {
      throw new HardhatFhevmError(`Network ${this.networkName} is not in state ${expectedState}`);
    }
  }

  public setState(newState: HardhatFhevmProviderState) {
    if (this._state === undefined) {
      this._state = newState;
      return;
    }
    if (newState < this._state) {
      throw new HardhatFhevmError(`Cannot set network ${this._networkName} state.`);
    }
    this._state = newState;
  }

  public async getState(): Promise<HardhatFhevmProviderState> {
    if (this._state === undefined) {
      const pt = await this.getProviderType();
      switch (pt) {
        case HardhatFhevmProviderType.Zama:
          this._state = HardhatFhevmProviderState.Deployed;
          break;
        default:
          this._state = HardhatFhevmProviderState.Undeployed;
          break;
      }
    }
    return this._state;
  }

  /**
   * No network restriction. This method is also called while deploying a new fhevm
   */
  public async createNewFhevmProvider(): Promise<HardhatFhevmProvider> {
    const pt = await this.getProviderType();
    if (pt === HardhatFhevmProviderType.Unknown) {
      throw new HardhatFhevmError(`Unsupported fhevm network: ${this.networkName}`);
    }
    if (pt === HardhatFhevmProviderType.Local) {
      return new LocalFhevmProvider(this, this._hre);
    } else if (pt === HardhatFhevmProviderType.Zama) {
      return new ZamaFhevmProvider(this, this._hre);
    }
    return new MockFhevmProvider(this, this._hre);
  }

  /**
   * Helper: Wait a given number of blocks. This is accomplished by either using
   * the built-in evm mining commands or sending empty transaction (when the node is not)
   * in auto-mining mode or simply waiting for the blocks to be mined.
   */
  public async waitNBlocks(nBlocks: number) {
    if (nBlocks <= 0) {
      return;
    }

    // Local functions: force new block by sending a blank transaction
    async function _sendZeroTx(blockCount: number, signer: HardhatEthersSigner, logOptions: LogOptions) {
      while (blockCount > 0) {
        blockCount--;
        logDim(`Wait one block, send empty tx`, logOptions);
        const receipt = await signer.sendTransaction({
          to: EthersT.ZeroAddress,
          value: 0n,
        });
        await receipt.wait();
      }
    }

    // Local functions: force new block calling hardhat_mine or anvil_mine
    async function _callMine(
      blockCount: number,
      ethProvider: EthereumProvider,
      method: string,
      logOptions: LogOptions,
    ) {
      while (blockCount > 0) {
        blockCount--;
        logDim(`Wait one block, call ${method}`, logOptions);
        // mine only one block does not work when network == built-in hardhat network
        await ethProvider.send(method, ["0x1"]);
      }
    }

    const pt = await this.getProviderType();
    const methods = await this.getRpcMethods();

    const provider: EthersT.Provider = this._provider;
    const eth_provider: EthereumProvider = this._eth_provider;
    const lo: LogOptions = this._hre.fhevm.logOptions;

    // Mine directly if the chain supports this feature (hardhat, anvil)
    const mine = methods.mine;
    if (mine) {
      // use built-in mine request
      await _callMine(nBlocks, eth_provider, mine, lo);
      return;
    }

    // Mine by sending empty tx
    // Zama chain does not support empty tx mining
    let zeroTxSigner: HardhatEthersSigner | undefined;
    if (
      pt !== HardhatFhevmProviderType.Unknown &&
      pt !== HardhatFhevmProviderType.Zama &&
      pt !== HardhatFhevmProviderType.Local
    ) {
      const signers = await this._hre.ethers.getSigners();
      zeroTxSigner = signers[0];
      assert(zeroTxSigner);
    }

    let blockCount = 0;
    return new Promise((resolve, reject) => {
      const onBlock = async (newBlockNumber: number) => {
        blockCount++;
        if (blockCount >= nBlocks) {
          await provider.off("block", onBlock);
          resolve(newBlockNumber);
        }
      };

      provider.on("block", onBlock).catch((err) => {
        reject(err);
      });

      if (zeroTxSigner) {
        _sendZeroTx(nBlocks, zeroTxSigner, lo);
      }
    });
  }
}
