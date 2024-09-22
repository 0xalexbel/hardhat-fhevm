import { FhevmInstance } from "fhevmjs/node";
import { HardhatFhevmZKInput } from "./HardhatFhevmZKInput";
import { EIP712 } from "fhevmjs/lib/sdk/keypair";

export abstract class HardhatFhevmInstance {
  protected innerInstance: FhevmInstance | undefined;

  public abstract get gatewayUrl(): string;

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
