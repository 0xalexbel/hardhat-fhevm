import assert from "assert";
import { ethers as EthersT } from "ethers";
import { HardhatFhevmDecryption } from "../types";
import { EthereumProvider, HardhatRuntimeEnvironment } from "hardhat/types";
import { HardhatFhevmProviderInfos, HardhatFhevmRuntimeLogOptions } from "../types";
import { DockerServices } from "./DockerServices";
import { HardhatFhevmInstance } from "./HardhatFhevmInstance";
import { ResultCallbackProcessor } from "./ResultCallbackProcessor";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { logDim, LogOptions } from "../log";
import { getUserPackageNodeModulesDir, zamaGetContrat, zamaReadContractAddressSync } from "./zamaContracts";
import { ZamaDev } from "../constants";
import { HardhatFhevmError } from "../error";

export enum HardhatFhevmRuntimeEnvironmentType {
  None = 0,
  Local,
  Mock,
  Zama,
}

export abstract class HardhatFhevmRuntimeEnvironment {
  protected hre: HardhatRuntimeEnvironment;
  private type: HardhatFhevmRuntimeEnvironmentType;
  private _dockerServices: DockerServices;
  private _logOptions: HardhatFhevmRuntimeLogOptions;
  private _providerInfos: HardhatFhevmProviderInfos | undefined;

  constructor(type: HardhatFhevmRuntimeEnvironmentType, hre: HardhatRuntimeEnvironment) {
    this.hre = hre;
    this.type = type;
    this._logOptions = { quiet: false, stderr: true };
    this._dockerServices = new DockerServices(hre, { ...this._logOptions });
  }

  public get runtimeType(): HardhatFhevmRuntimeEnvironmentType {
    return this.type;
  }

  public get logOptions() {
    return { ...this._logOptions };
  }

  public set logOptions(lo: HardhatFhevmRuntimeLogOptions) {
    this._logOptions = { ...lo };
  }

  public get dockerServices() {
    return this._dockerServices;
  }

  public gatewayRelayerWallet(provider?: null | EthersT.Provider) {
    return new EthersT.Wallet(this.hre.config.fhevmNode.gatewayRelayerPrivateKey, provider ?? this.hre.ethers.provider);
  }

  public async getProviderInfos(): Promise<HardhatFhevmProviderInfos> {
    if (this._providerInfos) {
      return this._providerInfos;
    }

    const pi: HardhatFhevmProviderInfos = {
      setBalance: undefined,
      setCode: undefined,
      mine: undefined,
    };

    const eth_provider = this.hre.network.provider;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const send_ops: Array<{ name: keyof HardhatFhevmProviderInfos; method: string; args: any[] }> = [
      { name: "setCode", method: "anvil_setCode", args: [EthersT.ZeroAddress, EthersT.ZeroHash] },
      { name: "setCode", method: "hardhat_setCode", args: [EthersT.ZeroAddress, EthersT.ZeroHash] },
      { name: "setBalance", method: "anvil_setBalance", args: [EthersT.ZeroAddress, EthersT.toQuantity(1234)] },
      { name: "setBalance", method: "hardhat_setBalance", args: [EthersT.ZeroAddress, EthersT.toQuantity(1234)] },
      { name: "mine", method: "anvil_mine", args: ["0x0"] },
      { name: "mine", method: "hardhat_mine", args: ["0x0"] },
    ];

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
        assert(e.message === `Method ${op.method} is not supported`, e.message);
      }
      return false;
    }

    const ok = await Promise.all(send_ops.map((op) => checkOp(op)));
    for (let i = 0; i < ok.length; ++i) {
      if (ok[i]) {
        pi[send_ops[i].name] = send_ops[i].method;
      }
    }

    this._providerInfos = pi;
    return this._providerInfos;
  }

  protected abstract resultprocessor(): Promise<ResultCallbackProcessor>;

  public abstract createInstance(): Promise<HardhatFhevmInstance>;
  public abstract decryptBool(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<boolean>;
  public abstract decrypt4(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint>;
  public abstract decrypt8(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint>;
  public abstract decrypt16(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint>;
  public abstract decrypt32(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint>;
  public abstract decrypt64(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint>;
  public abstract decryptAddress(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<string>;

  public async createEncryptedInput(contract: EthersT.AddressLike, user: EthersT.AddressLike) {
    const instance = await this.createInstance();
    const contractAddr = await EthersT.resolveAddress(contract, this.hre.ethers.provider);
    const userAddr = await EthersT.resolveAddress(user, this.hre.ethers.provider);
    return instance.createEncryptedInput(contractAddr, userAddr);
  }

  public abstract canSetBalance(): Promise<boolean>;
  public abstract batchSetBalance(addresses: Array<string>, amount: string): Promise<void>;

  public async waitForAllDecryptions(): Promise<HardhatFhevmDecryption[]> {
    const rp = await this.resultprocessor();
    const decs = await rp.waitForDecryptions();
    return decs;
  }

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

    const pi = await this.getProviderInfos();
    const provider: EthersT.Provider = this.hre.ethers.provider;
    const eth_provider: EthereumProvider = this.hre.network.provider;
    const runtimeType = this.runtimeType;
    const lo: LogOptions = this.logOptions;

    const mine = pi.mine;
    if (mine) {
      // use built-in mine request
      await _callMine(nBlocks, eth_provider, mine, lo);
      return;
    }

    // mine manually
    let signer: HardhatEthersSigner | undefined;
    if (runtimeType === HardhatFhevmRuntimeEnvironmentType.Mock) {
      const signers = await this.hre.ethers.getSigners();
      signer = signers[0];
      assert(signer);
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

      if (signer) {
        _sendZeroTx(nBlocks, signer, lo);
      }
    });
  }

  //   public async waitForTransactionDecryptions(tx: ethers.ContractTransactionResponse): Promise<{
  //     receipt: ethers.ContractTransactionReceipt;
  //     results: HardhatFhevmDecryption[];
  //   } | null> {
  //     const receipt = await tx.wait();
  //     if (!receipt) {
  //       return null;
  //     }
  //     // receipt.hash === decryptionRequests[i].txHash
  //     const decryptionRequests = await this.resultprocessor().parseEventDecryptionEvents(receipt.logs);
  //     const results = await this.resultprocessor().waitForDecryptions(decryptionRequests);
  //     return { receipt, results };
  //   }

  public readACLAddress() {
    return zamaReadContractAddressSync("ACL", getUserPackageNodeModulesDir(this.hre.config), ZamaDev);
  }
  public readKMSVerifierAddress() {
    return zamaReadContractAddressSync("KMSVerifier", getUserPackageNodeModulesDir(this.hre.config), ZamaDev);
  }
  public readFHEExecutorAddress() {
    return zamaReadContractAddressSync("TFHEExecutor", getUserPackageNodeModulesDir(this.hre.config), ZamaDev);
  }
  public readGatewayContractAddress() {
    return zamaReadContractAddressSync("GatewayContract", getUserPackageNodeModulesDir(this.hre.config), ZamaDev);
  }

  public async isAllowed(handle: EthersT.BigNumberish, userAddress: EthersT.AddressLike) {
    const acl = await zamaGetContrat(
      "ACL",
      getUserPackageNodeModulesDir(this.hre.config),
      ZamaDev,
      this.hre.ethers.provider,
      this.hre,
    );
    return await acl.persistAllowed(handle, userAddress);
  }

  protected async throwIfCanNotDecrypt(handle: bigint, contract: EthersT.AddressLike, user: EthersT.AddressLike) {
    const canDecrypt = await this.canDecrypt(handle, contract, user);
    if (!canDecrypt) {
      throw new HardhatFhevmError(
        `contract ${await EthersT.resolveAddress(contract)} or signer: ${await EthersT.resolveAddress(user)} does not have permission to decrypt handle ${handle}`,
      );
    }
  }

  public async canDecrypt(
    handle: EthersT.BigNumberish,
    contractAddress: EthersT.AddressLike,
    userAddress: EthersT.AddressLike,
  ) {
    const acl = await zamaGetContrat(
      "ACL",
      getUserPackageNodeModulesDir(this.hre.config),
      ZamaDev,
      this.hre.ethers.provider,
      this.hre,
    );
    const result = await Promise.all([
      acl.persistAllowed(handle, contractAddress),
      acl.persistAllowed(handle, userAddress),
    ]);
    return result[0] && result[1];
  }

  // public gatewayRelayerAddress() {
  //   return this.gatewayRelayerWallet().address;
  // }
  // private gatewayRelayerPrivateKey() {
  //   if (this.isMock()) {
  //     // no docker service in mock mode
  //     // return default.
  //     return this.hre.config.networks.fhevm.accounts.GatewayRelayerPrivateKey;
  //   }
  //   try {
  //     const key = this._dockerServices.gatewayServiceRelayerPrivateKey();
  //     assert(key === this.hre.config.networks.fhevm.accounts.GatewayRelayerPrivateKey);
  //     return key;
  //   } catch (err) {
  //     throw new HardhatFhevmError(`Unable to parse gateway relayer private key ${err}`);
  //   }
  // }
  // public gatewayRelayerWallet() {
  //   return new ethers.Wallet(this.gatewayRelayerPrivateKey(), this.hre.fhevm.provider());
  // }
}
