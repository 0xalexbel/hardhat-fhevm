import { ethers as EthersT } from "ethers";
import { FhevmInstance } from "fhevmjs/node";
import { bigIntToBytes } from "../utils";

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

  public addBytes256(value: EthersT.BigNumberish | EthersT.BytesLike): HardhatFhevmZKInput {
    let bytes: Uint8Array;
    if (EthersT.isBytesLike(value)) {
      bytes = EthersT.getBytes(value);
    } else {
      bytes = bigIntToBytes(EthersT.getBigInt(value));
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
