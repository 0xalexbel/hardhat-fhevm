import assert from "assert";
import { ethers as EthersT } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getInstallPrivKeyFile } from "../dirs";
import { readFileSync } from "fs";
import fhevmjs from "fhevmjs/node";
import { LocalFhevmInstance } from "./LocalFhevmInstance";
import { ResultCallbackProcessor } from "../common/ResultCallbackProcessor";
import { LocalResultCallbackProcessor } from "./LocalResultCallbackProcessor";
import { DockerServices } from "../common/DockerServices";
import { HardhatFhevmError } from "../error";
import { bigIntToAddress } from "../utils";
import { HardhatFhevmProvider } from "../common/HardhatFhevmProvider";
import { FhevmProviderInfos } from "../common/FhevmProviderInfos";
import { logDim } from "../log";
import { ZamaDev } from "../constants";

////////////////////////////////////////////////////////////////////////////////

interface FhevmjsDecryptor {
  decryptBool: (ciphertext: string) => boolean;
  decrypt4: (ciphertext: string) => number;
  decrypt8: (ciphertext: string) => number;
  decrypt16: (ciphertext: string) => number;
  decrypt32: (ciphertext: string) => number;
  decrypt64: (ciphertext: string) => bigint;
  decryptAddress: (ciphertext: string) => string;
}

////////////////////////////////////////////////////////////////////////////////

export class LocalFhevmProvider extends HardhatFhevmProvider {
  private _fhevmjs_decryptor: FhevmjsDecryptor | undefined;
  private _resultprocessor: LocalResultCallbackProcessor | undefined;
  private _instance: LocalFhevmInstance | undefined;
  private _privateKey: string | undefined;
  private _publicKey: string | undefined;
  private _dockerServices: DockerServices | undefined;

  // Flag
  public throwErrorIfGatewayDecryptionFailed: boolean;

  constructor(fhevmProviderInfos: FhevmProviderInfos, hre: HardhatRuntimeEnvironment) {
    super(fhevmProviderInfos, hre);
    this.throwErrorIfGatewayDecryptionFailed = !true;
  }

  private async dockerServices(): Promise<DockerServices> {
    if (!this._dockerServices) {
      this._dockerServices = new DockerServices(this.hre, { quiet: false, stderr: true });
      await this._dockerServices.initWith(ZamaDev, this.hre.config.fhevmNode);
    }
    return this._dockerServices;
  }

  private async _getInstance(): Promise<{ instance: LocalFhevmInstance; publicKey: string; privateKey: string }> {
    if (this._instance === undefined) {
      assert(!this._privateKey);
      assert(!this._publicKey);
      this._instance = await this.createInstance();
      const { publicKey, privateKey } = this._instance.generateKeypair();
      this._privateKey = privateKey;
      this._publicKey = publicKey;
    }

    assert(this._privateKey);
    assert(this._publicKey);
    return { instance: this._instance, privateKey: this._privateKey, publicKey: this._publicKey };
  }

  public async resultprocessor(): Promise<ResultCallbackProcessor> {
    if (!this._resultprocessor) {
      this._resultprocessor = new LocalResultCallbackProcessor(this.hre);
      await this._resultprocessor.init();
    }
    return this._resultprocessor;
  }

  private async _decryptor() {
    if (!this._fhevmjs_decryptor) {
      const cks = readFileSync(getInstallPrivKeyFile(this.hre.config.paths.fhevm));
      this._fhevmjs_decryptor = fhevmjs.clientKeyDecryptor(cks);
    }
    return this._fhevmjs_decryptor;
  }

  private async _getCiphertext(handle: bigint): Promise<string> {
    const cipherText = await this.hre.ethers.provider.call(fhevmjs.getCiphertextCallParams(handle));
    return cipherText;
  }

  private async _decryptHandle(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    if (handle === 0n) {
      return 0n;
    }

    const { instance, publicKey, privateKey } = await this._getInstance();

    const contractAddress = await EthersT.resolveAddress(contract);
    const signerAddress = await EthersT.resolveAddress(signer);

    const eip712 = instance.createEIP712(publicKey, contractAddress);
    const signature = await signer.signTypedData(eip712.domain, { Reencrypt: eip712.types.Reencrypt }, eip712.message);

    const clear = await instance.reencrypt(
      handle,
      privateKey,
      publicKey,
      signature.replace("0x", ""),
      contractAddress,
      signerAddress,
    );
    return clear;
  }

  protected async throwIfDecryptDiffers(
    expectedClearValue: bigint,
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ) {
    let gatewayDecryptionSucceeded = true;
    let clear;
    try {
      // Gateway decryption fails sometimes
      clear = await this._decryptHandle(handle, contract, signer);
    } catch (e) {
      if (this.throwErrorIfGatewayDecryptionFailed) {
        throw e;
      }
      gatewayDecryptionSucceeded = false;
    }

    if (gatewayDecryptionSucceeded) {
      if (clear !== expectedClearValue) {
        throw new HardhatFhevmError(`Gateway decryption differs from private key decryption.`);
      } else {
        logDim(`Gateway decryption succeeded. Local PK decryption : ${expectedClearValue}`, this.hre.fhevm.logOptions);
      }
    } else {
      logDim(`Gateway decryption failed. Local PK decryption : ${expectedClearValue}`, this.hre.fhevm.logOptions);
    }
  }

  public async createInstance(): Promise<LocalFhevmInstance> {
    assert(this.infos.url);
    const ds = await this.dockerServices();
    return LocalFhevmInstance.create(this.infos.url, ds.gatewayServiceUrl());
  }

  public async decryptBool(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<boolean> {
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    const clear = d.decryptBool(cipherText);
    const clearViaGateway = (await this._decryptHandle(handle, contract, signer)) !== 0n;
    if (clearViaGateway !== clear) {
      throw new HardhatFhevmError(`Gateway decryption differs from private key decryption.`);
    }
    return clear;
  }

  public async decrypt4(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    const clear = BigInt(d.decrypt4(cipherText));
    await this.throwIfDecryptDiffers(clear, handle, contract, signer);
    return clear;
  }

  public async decrypt8(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    const clear = BigInt(d.decrypt8(cipherText));
    await this.throwIfDecryptDiffers(clear, handle, contract, signer);
    return clear;
  }

  public async decrypt16(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    const clear = BigInt(d.decrypt16(cipherText));
    await this.throwIfDecryptDiffers(clear, handle, contract, signer);
    return clear;
  }

  public async decrypt32(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    const clear = BigInt(d.decrypt32(cipherText));
    await this.throwIfDecryptDiffers(clear, handle, contract, signer);
    return clear;
  }

  public async decrypt64(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    const clear = BigInt(d.decrypt64(cipherText));
    await this.throwIfDecryptDiffers(clear, handle, contract, signer);
    return clear;
  }

  public async decryptAddress(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<string> {
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    const clear = d.decryptAddress(cipherText);
    const clearViaGateway = await this._decryptHandle(handle, contract, signer);
    if (bigIntToAddress(clearViaGateway) !== clear) {
      throw new HardhatFhevmError(`Gateway decryption differs from private key decryption.`);
    }
    return clear;
  }

  public async canSetBalance(): Promise<boolean> {
    return true;
  }

  public async batchSetBalance(addresses: Array<string>, amount: string): Promise<void> {
    const ds = await this.dockerServices();
    await ds.setBalances(addresses, amount);
  }

  public override async isRunning(): Promise<boolean> {
    const ds = await this.dockerServices();
    const ok = await ds.isFhevmRunning();
    return ok;
  }
}
