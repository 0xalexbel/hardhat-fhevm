import { ethers as EthersT } from "ethers";
import { HardhatFhevmDecryption } from "../types";
import { HardhatRuntimeEnvironment, NetworkConfig } from "hardhat/types";
import { HardhatFhevmRuntimeLogOptions } from "../types";
import { HardhatFhevmInstance } from "./HardhatFhevmInstance";
import { getUserPackageNodeModulesDir, zamaGetContrat, zamaReadContractAddressSync } from "./zamaContracts";
import { ZamaDev } from "../constants";
import { HardhatFhevmError } from "../error";
import { HardhatFhevmProviderCapabilities, FhevmProviderInfos, HardhatFhevmRpcMethods } from "./FhevmProviderInfos";
import { HardhatFhevmProvider } from "./HardhatFhevmProvider";
import { HardhatFhevmProviderType } from "./HardhatFhevmProviderType";

export class HardhatFhevmRuntimeEnvironment {
  private _hre: HardhatRuntimeEnvironment;
  private _fhevmProviderInfos: FhevmProviderInfos;
  private _logOptions: HardhatFhevmRuntimeLogOptions;
  private _inner: HardhatFhevmProvider | undefined;

  constructor(hre: HardhatRuntimeEnvironment) {
    this._hre = hre;
    this._logOptions = { quiet: false, stderr: true };
    this._fhevmProviderInfos = new FhevmProviderInfos(hre.network.name, hre);
  }

  public get logOptions() {
    return { ...this._logOptions };
  }

  public set logOptions(lo: HardhatFhevmRuntimeLogOptions) {
    this._logOptions = { ...lo };
  }

  public gatewayRelayerWallet(provider?: null | EthersT.Provider) {
    return new EthersT.Wallet(
      this._hre.config.fhevmNode.gatewayRelayerPrivateKey,
      provider ?? this._hre.ethers.provider,
    );
  }

  public get networkName(): string {
    return this._fhevmProviderInfos.networkName;
  }

  public get networkConfig(): NetworkConfig {
    return this._hre.config.networks[this.networkName];
  }

  public async getChainId(): Promise<number> {
    const cid = await this._fhevmProviderInfos.getChainId();
    return cid;
  }

  public async isRunning(): Promise<boolean> {
    let ok = await this._fhevmProviderInfos.isRunning();
    if (!ok) {
      return false;
    }
    const inner = await this.inner();
    ok = await inner.isRunning();

    return ok;
  }

  public async isReady(): Promise<boolean> {
    const isReady = await this._fhevmProviderInfos.isReady();
    return isReady;
  }

  public async getProviderType(): Promise<HardhatFhevmProviderType> {
    const pt = await this._fhevmProviderInfos.getProviderType();
    return pt;
  }

  public async getProviderRpcMethods(): Promise<HardhatFhevmRpcMethods> {
    const mth = await this._fhevmProviderInfos.getRpcMethods();
    return mth;
  }

  public async getProviderCapabilities(): Promise<HardhatFhevmProviderCapabilities> {
    const caps = await this._fhevmProviderInfos.getCapabilities();
    return caps;
  }

  public async useMock(): Promise<boolean> {
    const ok = await this._fhevmProviderInfos.useMock();
    return ok;
  }

  public async useMockOnChainDecryption(): Promise<boolean> {
    const ok = await this._fhevmProviderInfos.useMockOnChainDecryption();
    return ok;
  }

  /**
   * Network must be ready
   */
  private async inner(): Promise<HardhatFhevmProvider> {
    if (!this._inner) {
      this._inner = await this._fhevmProviderInfos.createNewFhevmProvider();
    }
    return this._inner;
  }

  public setReady() {
    this._fhevmProviderInfos.setReady();
  }

  public async canSetBalance(): Promise<boolean> {
    const inner = await this.inner();
    return inner.canSetBalance();
  }

  public async batchSetBalance(addresses: Array<string>, amount: string): Promise<void> {
    const inner = await this.inner();
    await inner.batchSetBalance(addresses, amount);
  }

  public async createInstance(): Promise<HardhatFhevmInstance> {
    const inner = await this.inner();
    return inner.createInstance();
  }

  public async decryptBool(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<boolean> {
    const inner = await this.inner();
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    return inner.decryptBool(handle, contract, signer);
  }

  public async decrypt4(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const inner = await this.inner();
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    return inner.decrypt4(handle, contract, signer);
  }

  public async decrypt8(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const inner = await this.inner();
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    return inner.decrypt8(handle, contract, signer);
  }

  public async decrypt16(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const inner = await this.inner();
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    return inner.decrypt16(handle, contract, signer);
  }

  public async decrypt32(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const inner = await this.inner();
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    return inner.decrypt32(handle, contract, signer);
  }

  public async decrypt64(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const inner = await this.inner();
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    return inner.decrypt64(handle, contract, signer);
  }

  public async decryptAddress(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<string> {
    const inner = await this.inner();
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    return inner.decryptAddress(handle, contract, signer);
  }

  public async createEncryptedInput(contract: EthersT.AddressLike, user: EthersT.AddressLike) {
    const instance = await this.createInstance();
    const contractAddr = await EthersT.resolveAddress(contract, this._hre.ethers.provider);
    const userAddr = await EthersT.resolveAddress(user, this._hre.ethers.provider);
    return instance.createEncryptedInput(contractAddr, userAddr);
  }

  public async waitForAllDecryptions(): Promise<HardhatFhevmDecryption[]> {
    const inner = await this.inner();
    return await inner.waitForAllDecryptions();
  }

  public async waitForTransactionDecryptions(tx: EthersT.ContractTransactionResponse): Promise<{
    receipt: EthersT.ContractTransactionReceipt;
    results: HardhatFhevmDecryption[];
  } | null> {
    const inner = await this.inner();
    return await inner.waitForTransactionDecryptions(tx);
  }

  public async waitNBlocks(nBlocks: number) {
    await this._fhevmProviderInfos.waitNBlocks(nBlocks);
  }

  public readACLAddress() {
    return zamaReadContractAddressSync("ACL", getUserPackageNodeModulesDir(this._hre.config), ZamaDev);
  }

  public readKMSVerifierAddress() {
    return zamaReadContractAddressSync("KMSVerifier", getUserPackageNodeModulesDir(this._hre.config), ZamaDev);
  }

  public readFHEExecutorAddress() {
    return zamaReadContractAddressSync("TFHEExecutor", getUserPackageNodeModulesDir(this._hre.config), ZamaDev);
  }

  public readGatewayContractAddress() {
    return zamaReadContractAddressSync("GatewayContract", getUserPackageNodeModulesDir(this._hre.config), ZamaDev);
  }

  public async isAllowed(handle: EthersT.BigNumberish, userAddress: EthersT.AddressLike) {
    const acl = await zamaGetContrat(
      "ACL",
      getUserPackageNodeModulesDir(this._hre.config),
      ZamaDev,
      this._hre.ethers.provider,
      this._hre,
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

  protected async throwIfNotReady() {
    this._fhevmProviderInfos.throwIfNotReady();
  }

  public async canDecrypt(
    handle: EthersT.BigNumberish,
    contractAddress: EthersT.AddressLike,
    userAddress: EthersT.AddressLike,
  ) {
    const acl = await zamaGetContrat(
      "ACL",
      getUserPackageNodeModulesDir(this._hre.config),
      ZamaDev,
      this._hre.ethers.provider,
      this._hre,
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
