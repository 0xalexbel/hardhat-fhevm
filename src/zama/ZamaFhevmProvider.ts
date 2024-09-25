import assert from "assert";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { HardhatFhevmError } from "../error";
import { HardhatFhevmInstance } from "../common/HardhatFhevmInstance";
import { ResultCallbackProcessor } from "../common/ResultCallbackProcessor";
import { ZamaFhevmInstance } from "./ZamaFhevmInstance";
import { ethers as EthersT } from "ethers";
import { bigIntToAddress } from "../utils";
import { HardhatFhevmProvider } from "../common/HardhatFhevmProvider";
import { FhevmProviderInfos } from "../common/FhevmProviderInfos";

////////////////////////////////////////////////////////////////////////////////

export class ZamaFhevmProvider extends HardhatFhevmProvider {
  private _instance: ZamaFhevmInstance | undefined;
  private _privateKey: string | undefined;
  private _publicKey: string | undefined;

  constructor(fhevmProviderInfos: FhevmProviderInfos, hre: HardhatRuntimeEnvironment) {
    super(fhevmProviderInfos, hre);
  }

  public resultprocessor(): Promise<ResultCallbackProcessor> {
    throw new HardhatFhevmError("Method not implemented.");
  }

  private async _getInstance(): Promise<{ instance: ZamaFhevmInstance; publicKey: string; privateKey: string }> {
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

  public createInstance(): Promise<HardhatFhevmInstance> {
    return ZamaFhevmInstance.create(this.hre);
  }

  public async decryptBool(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<boolean> {
    const clear = await this._decryptHandle(handle, contract, signer);
    return clear !== 0n;
  }

  public async decrypt4(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const clear = await this._decryptHandle(handle, contract, signer);
    return clear;
  }

  public async decrypt8(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const clear = await this._decryptHandle(handle, contract, signer);
    return clear;
  }

  public async decrypt16(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const clear = await this._decryptHandle(handle, contract, signer);
    return clear;
  }

  public async decrypt32(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const clear = await this._decryptHandle(handle, contract, signer);
    return clear;
  }

  public async decrypt64(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const clear = await this._decryptHandle(handle, contract, signer);
    return clear;
  }

  public async decryptAddress(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<string> {
    const clear = await this._decryptHandle(handle, contract, signer);
    return bigIntToAddress(clear);
  }

  public async canSetBalance(): Promise<boolean> {
    return false;
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public batchSetBalance(_addresses: Array<string>, _amount: string): Promise<void> {
    throw new HardhatFhevmError("Method not supported.");
  }

  public override async isRunning(): Promise<boolean> {
    return true;
  }
}
