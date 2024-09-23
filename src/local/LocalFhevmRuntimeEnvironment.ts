import { ethers as EthersT } from "ethers";
import { HardhatRuntimeEnvironment, NetworkConfig } from "hardhat/types";
import {
  HardhatFhevmRuntimeEnvironment,
  HardhatFhevmRuntimeEnvironmentType,
} from "../common/HardhatFhevmRuntimeEnvironment";
import { getInstallPrivKeyFile } from "../dirs";
import { readFileSync } from "fs";
import fhevmjs from "fhevmjs/node";
import { LocalFhevmInstance } from "./LocalFhevmInstance";
import { ResultCallbackProcessor } from "../common/ResultCallbackProcessor";
import { LocalResultCallbackProcessor } from "./LocalResultCallbackProcessor";
import { DockerServices } from "../common/DockerServices";

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

export class LocalFhevmRuntimeEnvironment extends HardhatFhevmRuntimeEnvironment {
  private _fhevmjs_decryptor: FhevmjsDecryptor | undefined;
  private _resultprocessor: LocalResultCallbackProcessor | undefined;

  constructor(hre: HardhatRuntimeEnvironment) {
    super(HardhatFhevmRuntimeEnvironmentType.Local, hre);
  }

  protected async resultprocessor(): Promise<ResultCallbackProcessor> {
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

  public async createInstance(): Promise<LocalFhevmInstance> {
    return LocalFhevmInstance.create(this.hre);
  }

  public async decryptBool(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<boolean> {
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    return d.decryptBool(cipherText);
  }

  public async decrypt4(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    return BigInt(d.decrypt4(cipherText));
  }

  public async decrypt8(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    return BigInt(d.decrypt8(cipherText));
  }

  public async decrypt16(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    return BigInt(d.decrypt16(cipherText));
  }

  public async decrypt32(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    return BigInt(d.decrypt32(cipherText));
  }

  public async decrypt64(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    return d.decrypt64(cipherText);
  }

  public async decryptAddress(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<string> {
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    const d = await this._decryptor();
    const cipherText = await this._getCiphertext(handle);
    return d.decryptAddress(cipherText);
  }

  public async canSetBalance(): Promise<boolean> {
    return true;
  }

  public async batchSetBalance(addresses: Array<string>, amount: string): Promise<void> {
    await this.dockerServices.setBalances(addresses, amount);
  }

  static isLocalNetwork(networkConfig: NetworkConfig): boolean {
    if (!("url" in networkConfig)) {
      return false;
    }
    if (networkConfig.chainId !== DockerServices.chainId) {
      return false;
    }
    const u = new URL(networkConfig.url);
    if (u.hostname !== "localhost") {
      return false;
    }
    if (u.protocol !== "http:") {
      return false;
    }
    return true;
  }
}
