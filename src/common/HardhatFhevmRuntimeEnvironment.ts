import { FhevmInstance } from "fhevmjs/node";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DockerServices } from "./DockerServices";
import assert from "assert";
import { HardhatFhevmError, LogOptions } from "./error";
import { ethers } from "ethers";
import { LOCAL_FHEVM_NETWORK_NAME } from "../constants";
import { EIP712 } from "fhevmjs/lib/sdk/keypair";
import { bigIntToBytes } from "./utils";
import { getUserPackageNodeModulesDir, readFhevmContractAddress } from "./contracts";
import { HardhatEthersProvider } from "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider";
import { ResultCallbackProcessor } from "./ResultCallbackProcessor";
import { HardhatFhevmDecryption } from "../types";

export enum FhevmRuntimeEnvironmentType {
  Fhe = 0,
  Mock,
}

export class HardhatFhevmDecryptionRequest {}

export abstract class HardhatFhevmRuntimeEnvironment {
  protected hre: HardhatRuntimeEnvironment;
  private type: FhevmRuntimeEnvironmentType;
  private _dockerServices: DockerServices;
  private _forceUseLocalFhevmNetwork: boolean;
  private _initialized: boolean;
  private jsonRpcProvider: ethers.JsonRpcProvider | undefined;
  protected _resultprocessor: ResultCallbackProcessor | undefined;
  private _logOptions: LogOptions;

  constructor(type: FhevmRuntimeEnvironmentType, hre: HardhatRuntimeEnvironment) {
    this.hre = hre;
    this.type = type;
    this._forceUseLocalFhevmNetwork = false;
    this._initialized = false;
    this._dockerServices = new DockerServices(hre);
    this._logOptions = { quiet: false, stderr: true };
  }

  public __enterForceLocal() {
    assert(!this._forceUseLocalFhevmNetwork);
    if (this.hre.network.name !== LOCAL_FHEVM_NETWORK_NAME) {
      this._forceUseLocalFhevmNetwork = true;
    }
  }

  public __exitForceLocal() {
    this._forceUseLocalFhevmNetwork = false;
  }

  public hardhatProvider(): HardhatEthersProvider {
    if (this.isConfliting()) {
      throw new HardhatFhevmError("Conflicting network");
    }
    return this.hre.ethers.provider;
  }

  public provider(): ethers.Provider {
    if (this.isConfliting()) {
      if (!this.jsonRpcProvider) {
        this.jsonRpcProvider = new ethers.JsonRpcProvider(this.hre.config.networks.fhevm.url, {
          chainId: this.hre.config.networks.fhevm.chainId,
          name: LOCAL_FHEVM_NETWORK_NAME,
        });
      }
      return this.jsonRpcProvider;
    } else {
      return this.hre.ethers.provider;
    }
  }

  public setQuiet(quiet: boolean) {
    this._logOptions.quiet = quiet;
  }

  public logOptions() {
    return { ...this._logOptions };
  }

  protected resultprocessor(): ResultCallbackProcessor {
    return this._resultprocessor!;
  }

  public runtimeType(): FhevmRuntimeEnvironmentType {
    return this.type;
  }

  public isUserRequested(): boolean {
    return HardhatFhevmRuntimeEnvironment.isUserRequested(this.hre);
  }

  public isConfliting(): boolean {
    return this._forceUseLocalFhevmNetwork && this.hre.network.name !== LOCAL_FHEVM_NETWORK_NAME;
  }

  public isLocal(): boolean {
    return this.hre.network.name === LOCAL_FHEVM_NETWORK_NAME || this._forceUseLocalFhevmNetwork;
  }

  public isMock(): boolean {
    return this.hre.network.name === "hardhat" && !this._forceUseLocalFhevmNetwork;
  }

  public static isUserRequested(hre: HardhatRuntimeEnvironment): boolean {
    return HardhatFhevmRuntimeEnvironment.mockRequested(hre) || HardhatFhevmRuntimeEnvironment.localRequested(hre);
  }

  public static mockRequested(hre: HardhatRuntimeEnvironment): boolean {
    return hre.network.name === "hardhat" && hre.config.networks.hardhat.mockFhevm;
  }

  public static localRequested(hre: HardhatRuntimeEnvironment): boolean {
    return hre.network.name === LOCAL_FHEVM_NETWORK_NAME;
  }

  public get initialized() {
    return this._initialized;
  }

  public async init() {
    if (this._initialized) {
      throw new HardhatFhevmError("FhevmRuntimeEnvironment already initialized");
    }
    this._initialized = true;
  }

  public abstract createInstance(): Promise<HardhatFhevmInstance>;
  public abstract decryptBool(handle: bigint): Promise<boolean>;
  public abstract decrypt4(handle: bigint): Promise<bigint>;
  public abstract decrypt8(handle: bigint): Promise<bigint>;
  public abstract decrypt16(handle: bigint): Promise<bigint>;
  public abstract decrypt32(handle: bigint): Promise<bigint>;
  public abstract decrypt64(handle: bigint): Promise<bigint>;
  public abstract decryptAddress(handle: bigint): Promise<string>;

  public async createEncryptedInput(contract: ethers.AddressLike, user: ethers.AddressLike) {
    const instance = await this.createInstance();
    const contractAddr = await this.hre.ethers.resolveAddress(contract);
    const userAddr = await this.hre.ethers.resolveAddress(user);
    return instance.createEncryptedInput(contractAddr, userAddr);
  }

  public ACLAddress() {
    return readFhevmContractAddress("ACL", getUserPackageNodeModulesDir(this.hre.config));
  }

  public KMSVerifierAddress() {
    return readFhevmContractAddress("KMSVerifier", getUserPackageNodeModulesDir(this.hre.config));
  }

  public FHEExecutorAddress() {
    return readFhevmContractAddress("TFHEExecutor", getUserPackageNodeModulesDir(this.hre.config));
  }

  public GatewayContractAddress() {
    return readFhevmContractAddress("GatewayContract", getUserPackageNodeModulesDir(this.hre.config));
  }

  public gatewayRelayerAddress() {
    return this.gatewayRelayerWallet().address;
  }

  private gatewayRelayerPrivateKey() {
    if (this.isMock()) {
      // no docker service in mock mode
      // return default.
      return this.hre.config.networks.fhevm.accounts.GatewayRelayerPrivateKey;
    }

    try {
      const key = this._dockerServices.gatewayServiceRelayerPrivateKey();
      assert(key === this.hre.config.networks.fhevm.accounts.GatewayRelayerPrivateKey);
      return key;
    } catch (err) {
      throw new HardhatFhevmError(`Unable to parse gateway relayer private key ${err}`);
    }
  }

  public gatewayRelayerWallet() {
    return new ethers.Wallet(this.gatewayRelayerPrivateKey(), this.hre.fhevm.provider());
  }

  public dockerServices() {
    return this._dockerServices;
  }

  public async waitForAllDecryptions(): Promise<HardhatFhevmDecryption[]> {
    return await this.resultprocessor().waitForDecryptions();
  }

  public async waitForTransactionDecryptions(tx: ethers.ContractTransactionResponse): Promise<{
    receipt: ethers.ContractTransactionReceipt;
    results: HardhatFhevmDecryption[];
  } | null> {
    const receipt = await tx.wait();

    if (!receipt) {
      return null;
    }

    // receipt.hash === decryptionRequests[i].txHash
    const decryptionRequests = await this.resultprocessor().parseEventDecryptionEvents(receipt.logs);

    const results = await this.resultprocessor().waitForDecryptions(decryptionRequests);

    return { receipt, results };
  }
}

////////////////////////////////////////////////////////////////////////////////
// HardhatFhevmZKInput
////////////////////////////////////////////////////////////////////////////////

export class HardhatFhevmZKInput {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private _zkInput: any;

  public static createEncryptedInput(
    instance: FhevmInstance,
    contractAddress: string,
    userAddress: string,
  ): HardhatFhevmZKInput {
    const _zkInput = instance.createEncryptedInput(contractAddress, userAddress);
    const zk = new HardhatFhevmZKInput();
    zk._zkInput = _zkInput;
    return zk;
  }

  public addBool(value: boolean): HardhatFhevmZKInput {
    this._zkInput = this._zkInput.addBool(value);
    return this;
  }

  public add4(value: number | bigint): HardhatFhevmZKInput {
    this._zkInput = this._zkInput.add4(value);
    return this;
  }

  public add8(value: number | bigint): HardhatFhevmZKInput {
    this._zkInput = this._zkInput.add8(value);
    return this;
  }

  public add16(value: number | bigint): HardhatFhevmZKInput {
    this._zkInput = this._zkInput.add16(value);
    return this;
  }

  public add32(value: number | bigint): HardhatFhevmZKInput {
    this._zkInput = this._zkInput.add32(value);
    return this;
  }

  public add64(value: number | bigint): HardhatFhevmZKInput {
    this._zkInput = this._zkInput.add64(value);
    return this;
  }

  public add128(value: number | bigint): HardhatFhevmZKInput {
    this._zkInput = this._zkInput.add128(value);
    return this;
  }

  public add256(value: number | bigint): HardhatFhevmZKInput {
    this._zkInput = this._zkInput.add256(value);
    return this;
  }

  public addBytes256(value: ethers.BigNumberish | ethers.BytesLike): HardhatFhevmZKInput {
    let bytes: Uint8Array;
    if (ethers.isBytesLike(value)) {
      bytes = ethers.getBytes(value);
    } else {
      bytes = bigIntToBytes(ethers.getBigInt(value));
    }
    this._zkInput.addBytes256(bytes);
    return this;
  }

  public addAddress(value: string): HardhatFhevmZKInput {
    this._zkInput = this._zkInput.addAddress(value);
    return this;
  }

  public resetValues(/*value: string*/): HardhatFhevmZKInput {
    this._zkInput = this._zkInput.resetValues();
    return this;
  }

  public getValues(): bigint[] {
    return this._zkInput.getValues();
  }

  public getBits(): number[] {
    return this._zkInput.getBits();
  }

  public encrypt(): {
    handles: Uint8Array[];
    inputProof: Uint8Array;
  } {
    return this._zkInput.encrypt();
  }

  public async send(): Promise<{
    handles: Uint8Array[];
    inputProof: Uint8Array;
  }> {
    return this._zkInput.send();
  }
}

export abstract class HardhatFhevmInstance {
  protected innerInstance: FhevmInstance | undefined;

  public createEncryptedInput(contractAddress: string, userAddress: string): HardhatFhevmZKInput {
    return HardhatFhevmZKInput.createEncryptedInput(this.innerInstance!, contractAddress, userAddress);
  }

  public generateKeypair(): {
    publicKey: string;
    privateKey: string;
  } {
    return this.innerInstance!.generateKeypair();
  }

  public createEIP712(publicKey: string, contractAddress: string, userAddress?: string): EIP712 {
    return this.innerInstance!.createEIP712(publicKey, contractAddress, userAddress);
  }

  public reencrypt(
    handle: bigint,
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddress: string,
    userAddress: string,
  ): Promise<bigint> {
    return this.innerInstance!.reencrypt(handle, privateKey, publicKey, signature, contractAddress, userAddress);
  }

  public getPublicKey(): string | null {
    return this.innerInstance!.getPublicKey();
  }
}
