import { ethers as EthersT } from "ethers";
import assert from "assert";
import fs from "fs";
import { DockerServices } from "../../DockerServices";
import { FhevmEnvironment } from "../../FhevmEnvironment";
import { FhevmProviderType } from "../../FhevmProviderType";
import { HardhatFhevmError } from "../../../error";
import fhevmjs from "fhevmjs/node";
import { NativeFhevmProvider } from "../../FhevmProvider";

////////////////////////////////////////////////////////////////////////////////

type FhevmjsClientKeyDecryptor = ReturnType<typeof fhevmjs.clientKeyDecryptor>;

////////////////////////////////////////////////////////////////////////////////

export class LocalFhevmProvider extends NativeFhevmProvider {
  private static __constructorGuard: boolean = true;

  private _dockerServices: DockerServices;
  private _fhevmjs_decryptor: FhevmjsClientKeyDecryptor | undefined;

  constructor(providerType: FhevmProviderType, fhevmEnv: FhevmEnvironment, dockerServices: DockerServices) {
    if (LocalFhevmProvider.__constructorGuard) {
      throw new HardhatFhevmError(`LocalFhevmProvider constructor is not accessible, use static create`);
    }
    LocalFhevmProvider.__constructorGuard = true;

    assert(providerType === FhevmProviderType.Local);
    super(providerType, fhevmEnv);
    this._dockerServices = dockerServices;
    assert(dockerServices.initialized);
  }

  public static async create(
    providerType: FhevmProviderType,
    fhevmEnv: FhevmEnvironment,
    dockerServices: DockerServices,
  ) {
    assert(LocalFhevmProvider.__constructorGuard);
    LocalFhevmProvider.__constructorGuard = false;

    const p = new LocalFhevmProvider(providerType, fhevmEnv, dockerServices);
    await p.init();
    return p;
  }

  protected override async init() {
    await super.init();
  }

  /**
   * Native urls abstract methods
   */

  public override get networkUrl(): string {
    return this.dockerServices.validatorServiceUrl();
  }

  public override get gatewayUrl(): string {
    return this.dockerServices.gatewayServiceUrl();
  }

  /**
   * Balance abstract methods
   */

  public override async canSetBalance(): Promise<boolean> {
    return true;
  }

  public override async batchSetBalance(addresses: Array<string>, amount: string): Promise<void> {
    await this.dockerServices.setBalances(addresses, amount);
  }

  public override async coreDecryptBool(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<boolean> {
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    const clear = d.decryptBool(cipherText);
    await this.throwIfBoolGatewayDecryptDiffers(clear, handle, contract, signer, "Local PK");
    return clear;
  }

  public override async coreDecrypt4(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    const clear = BigInt(d.decrypt4(cipherText));
    await this.throwIfNumGatewayDecryptDiffers(clear, handle, contract, signer, "Local PK");
    return clear;
  }

  public override async coreDecrypt8(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    const clear = BigInt(d.decrypt8(cipherText));
    await this.throwIfNumGatewayDecryptDiffers(clear, handle, contract, signer, "Local PK");
    return clear;
  }

  public override async coreDecrypt16(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    const clear = BigInt(d.decrypt16(cipherText));
    await this.throwIfNumGatewayDecryptDiffers(clear, handle, contract, signer, "Local PK");
    return clear;
  }

  public override async coreDecrypt32(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    const clear = BigInt(d.decrypt32(cipherText));
    await this.throwIfNumGatewayDecryptDiffers(clear, handle, contract, signer, "Local PK");
    return clear;
  }

  public override async coreDecrypt64(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    const clear = BigInt(d.decrypt64(cipherText));
    await this.throwIfNumGatewayDecryptDiffers(clear, handle, contract, signer, "Local PK");
    return clear;
  }

  public async coreDecryptAddress(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<string> {
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    const clear = d.decryptAddress(cipherText);
    await this.throwIfStringGatewayDecryptDiffers(clear, handle, contract, signer, "Local PK");
    return clear;
  }

  private async _decryptor() {
    if (!this._fhevmjs_decryptor) {
      const fhevmjs = await import("fhevmjs/node");
      const cks = fs.readFileSync(this.dockerServices.paths.privKeyFile);
      this._fhevmjs_decryptor = fhevmjs.clientKeyDecryptor(cks);
    }
    return this._fhevmjs_decryptor;
  }

  private async _getCiphertext(handle: bigint): Promise<string> {
    const fhevmjs = await import("fhevmjs/node");
    const callParams = fhevmjs.getCiphertextCallParams(handle);
    const cipherText = await this.provider.call(callParams);
    return cipherText;
  }

  public get dockerServices(): DockerServices {
    return this._dockerServices;
  }
}

////////////////////////////////////////////////////////////////////////////////
