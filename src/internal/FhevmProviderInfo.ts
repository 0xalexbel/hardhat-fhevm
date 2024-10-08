import assert from "assert";
import { ethers as EthersT } from "ethers";
import { EthereumProvider } from "hardhat/types";
import { ProviderRpcMethods } from "./types";
import { HardhatFhevmError } from "../error";
import { DEV_NODE_CHAINID, EXT_TFHE_LIBRARY, FhevmTypeNative, ZAMA_DEV_NETWORK_CONFIG } from "../constants";
import { FhevmEnvironment } from "./FhevmEnvironment";
import { LOCAL_FHEVM_CHAIN_ID } from "./DockerServicesConfig";
import { isDeployed } from "./utils/eth_utils";
import { HARDHAT_NETWORK_NAME } from "hardhat/plugins";
import { FhevmProviderType } from "./FhevmProviderType";

export class FhevmProviderInfo {
  private _chainId: number | undefined;
  private _verifiedChainId: number | undefined;
  private _rpcMethods: ProviderRpcMethods | undefined;
  private _provider: EthersT.Provider | undefined;
  private _ethProvider: EthereumProvider | undefined;
  private _fhevmEnv: FhevmEnvironment;
  private _resolvedProviderType: FhevmProviderType | undefined;
  private _ethNetworkAvailable: boolean | undefined;
  private _ethNetwork: EthersT.Network | undefined;

  constructor(
    provider: EthersT.Provider | undefined,
    ethProvider: EthereumProvider | undefined,
    fhevmEnv: FhevmEnvironment,
  ) {
    this._provider = provider;
    this._ethProvider = ethProvider;
    this._fhevmEnv = fhevmEnv;
  }

  /**
   * Dynamic, computed at each call.
   */
  public async isRunning(): Promise<boolean> {
    if (this._ethNetworkAvailable === undefined) {
      if (!this._provider) {
        this._ethNetworkAvailable = false;
      } else {
        try {
          this._ethNetwork = await this._provider.getNetwork();
          this._ethNetworkAvailable = true;
        } catch {
          this._ethNetworkAvailable = false;
        }
      }
    }

    return this._ethNetworkAvailable;
  }

  /**
   * Lazy, computed only once.
   */
  public async getRpcMethods(): Promise<ProviderRpcMethods> {
    if (!this._ethProvider) {
      return {
        setBalance: undefined,
        setCode: undefined,
        mine: undefined,
        evmSnapshot: undefined,
        evmRevert: undefined,
      };
    }

    if (this._rpcMethods) {
      return this._rpcMethods;
    }

    if (!(await this.isRunning())) {
      throw new HardhatFhevmError(`Unable to connect to network`);
    }

    const mth: ProviderRpcMethods = {
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
    const send_ops: Array<{ name: keyof ProviderRpcMethods; method: string; args: any[] }> = [
      { name: "setCode", method: "hardhat_setCode", args: [EthersT.ZeroAddress, EthersT.ZeroHash] },
      { name: "setCode", method: "anvil_setCode", args: [EthersT.ZeroAddress, EthersT.ZeroHash] },
      { name: "setBalance", method: "hardhat_setBalance", args: [EthersT.ZeroAddress, EthersT.toQuantity(1234)] },
      { name: "setBalance", method: "anvil_setBalance", args: [EthersT.ZeroAddress, EthersT.toQuantity(1234)] },
      { name: "mine", method: "hardhat_mine", args: ["0x0"] },
      { name: "mine", method: "anvil_mine", args: ["0x0"] },
    ];

    const eth_provider = this._ethProvider;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    async function checkOp(op: { name: keyof ProviderRpcMethods; method: string; args: any[] }): Promise<boolean> {
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

  public async getChainId(): Promise<number> {
    const chainId = await this._getChainId(true);
    assert(chainId !== undefined);
    return chainId;
  }

  public async hasChainId(): Promise<boolean> {
    const chainId = await this._getChainId(false);
    return chainId !== undefined;
  }

  /**
   * Lazy, computed only once.
   */
  private async _getChainId(throwIfFailed: boolean): Promise<number | undefined> {
    if (this._verifiedChainId === undefined) {
      if (await this.isRunning()) {
        // connection
        assert(this._ethNetwork);
        this._verifiedChainId = Number(this._ethNetwork.chainId);
      } else {
        // No connection
        if (this._fhevmEnv.network?.chainId === undefined) {
          if (throwIfFailed) {
            throw new HardhatFhevmError(
              `Network ${this._fhevmEnv.networkName} has no chainId specified in the hardhat.config file. Please add a valid chainId.`,
            );
          }
          return undefined;
        }
        this._verifiedChainId = this._fhevmEnv.network.chainId;
      }
    }
    if (this._chainId === undefined) {
      this._chainId = this._verifiedChainId;
    } else {
      if (this._verifiedChainId !== this._chainId) {
        if (throwIfFailed) {
          throw new HardhatFhevmError(
            `The network server chainId differs from the chainId specified in the hardhat.config file`,
          );
        }
        return undefined;
      }
    }

    return this._chainId;
  }

  /**
   * Resolve Fhevm provider type.
   * If available, use a network connection to perform a more accurate test.
   */
  public async resolveFhevmProviderType() {
    if (this._resolvedProviderType !== undefined) {
      return this._resolvedProviderType;
    }
    if (this.isHardhat()) {
      this._resolvedProviderType = FhevmProviderType.Hardhat;
      return this._resolvedProviderType;
    }

    if (!(await this.hasChainId())) {
      this._resolvedProviderType = FhevmProviderType.Unknown;
      return this._resolvedProviderType;
    }

    const useNetworkConnection = await this.isRunning();
    const chainId = await this.getChainId();
    let rpcMethods;
    if (useNetworkConnection) {
      rpcMethods = await this.getRpcMethods();
    } else {
      rpcMethods = undefined;
    }

    if (this.isHardhatNode(chainId, rpcMethods)) {
      this._resolvedProviderType = FhevmProviderType.HardhatNode;
    } else if (rpcMethods && this.isAnvil(rpcMethods, useNetworkConnection)) {
      this._resolvedProviderType = FhevmProviderType.Anvil;
    } else if (this.isZama(chainId, rpcMethods)) {
      this._resolvedProviderType = FhevmProviderType.Zama;
    } else if (await this.isLocal(chainId, rpcMethods, useNetworkConnection)) {
      this._resolvedProviderType = FhevmProviderType.Local;
    } else {
      this._resolvedProviderType = FhevmProviderType.Unknown;
    }
    return this._resolvedProviderType;
  }

  private isHardhat() {
    const yes = this._fhevmEnv.networkName === HARDHAT_NETWORK_NAME;
    // Always in sync with userDeployOptions
    assert((yes && this._fhevmEnv.isMock) || !yes);
    return yes;
  }

  /**
   * network connection is required
   * RpcMethods are required
   */
  private isAnvil(rpcMethods: ProviderRpcMethods, useNetworkConnection: boolean) {
    if (this.isHardhat()) {
      return false;
    }
    if (!useNetworkConnection) {
      return false;
    }
    if (rpcMethods.setCode !== "anvil_setCode") {
      return false;
    }
    // can't detect without url
    const url = this._fhevmEnv.networkUrl;
    if (!url) {
      return false;
    }
    const hostname = new URL(url).hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return false;
    }

    // Always in sync with userDeployOptions
    assert(this._fhevmEnv.isMock);
    return true;
  }

  /**
   * network connection is optional
   * chainId is required.
   * RpcMethods are optional
   */
  private isHardhatNode(chainId: number, rpcMethods: ProviderRpcMethods | undefined) {
    if (this.isHardhat()) {
      return false;
    }

    // Contrary to the 'isAnvil' testing, we continue the detection even without the rpc methods.
    // If we have the rpcMethods, use them to perform a more accurate testing
    if (rpcMethods && rpcMethods.setCode !== "hardhat_setCode") {
      return false;
    }

    // Without rpc methods, use chainid instead. Not perfectly accurate, since anvil default chainId = 31337 as well...
    if (!rpcMethods) {
      if (chainId !== DEV_NODE_CHAINID) {
        return false;
      }
    }

    // can't detect without url
    const url = this._fhevmEnv.networkUrl;
    if (!url) {
      return false;
    }

    const hostname = new URL(url).hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return false;
    }

    // Always in sync with userDeployOptions
    assert(this._fhevmEnv.isMock);
    return true;
  }

  /**
   * RpcMethods are optional
   */
  private isZama(chainId: number, rpcMethods: ProviderRpcMethods | undefined) {
    if (chainId !== ZAMA_DEV_NETWORK_CONFIG.chainId) {
      return false;
    }
    if (this._fhevmEnv.networkUrl === ZAMA_DEV_NETWORK_CONFIG.url) {
      // For debug purpose
      assert(!rpcMethods?.mine);
      assert(!rpcMethods?.setCode);
      assert(!rpcMethods?.evmRevert);
      assert(!rpcMethods?.evmSnapshot);
      assert(!rpcMethods?.setBalance);
      // Always in sync with userDeployOptions
      assert(!this._fhevmEnv.isMock);
      return true;
    }
    return false;
  }

  /**
   * Is considered as "local" if :
   * - same chainId
   * - hostname is "localhost" or "127.0.0.1"
   * - no rpc methods
   * - EXT_TFHE_LIBRARY is deployed
   */
  private async isLocal(chainId: number, rpcMethods: ProviderRpcMethods | undefined, useNetworkConnection: boolean) {
    if (chainId !== LOCAL_FHEVM_CHAIN_ID) {
      return false;
    }

    if (rpcMethods) {
      const someDefined = Object.keys(rpcMethods).some(
        (key: string) => rpcMethods[key as keyof ProviderRpcMethods] !== undefined,
      );
      // Local has no rpc method
      if (someDefined) {
        return false;
      }
    }

    // can't detect without url
    const url = this._fhevmEnv.networkUrl;
    if (!url) {
      return false;
    }

    const hostname = new URL(url).hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return false;
    }

    if (useNetworkConnection) {
      // Too strict (doesn't work at deploy time...)
      const yes = await isDeployed(EXT_TFHE_LIBRARY, this._provider);
      if (yes) {
        // Always in sync with userDeployOptions
        assert(!this._fhevmEnv.isMock);
        return true;
      }
    }

    // Since the test above is too strict, add network test
    if (this._fhevmEnv.network?.fhevm === FhevmTypeNative) {
      // Always in sync with userDeployOptions
      assert(!this._fhevmEnv.isMock);
      return true;
    }

    return false;
  }
}
