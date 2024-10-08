import { ethers as EthersT } from "ethers";
import assert from "assert";
import { FhevmEnvironment } from "../../FhevmEnvironment";
import { FhevmProviderType } from "../../FhevmProviderType";
import { HardhatFhevmError } from "../../../error";
import { ZAMA_DEV_GATEWAY_URL, ZAMA_DEV_NETWORK_CONFIG } from "../../../constants";
import { NativeFhevmProvider } from "../../FhevmProvider";
import { bigIntToAddress } from "../../utils/address";

////////////////////////////////////////////////////////////////////////////////

export class ZamaFhevmProvider extends NativeFhevmProvider {
  private static __constructorGuard: boolean = true;

  constructor(providerType: FhevmProviderType, fhevmEnv: FhevmEnvironment) {
    if (ZamaFhevmProvider.__constructorGuard) {
      throw new HardhatFhevmError(`ZamaFhevmProvider constructor is not accessible, use static create`);
    }
    ZamaFhevmProvider.__constructorGuard = true;

    assert(providerType === FhevmProviderType.Zama);
    super(providerType, fhevmEnv);
  }

  public static async create(providerType: FhevmProviderType, fhevmEnv: FhevmEnvironment) {
    assert(ZamaFhevmProvider.__constructorGuard);
    ZamaFhevmProvider.__constructorGuard = false;

    const p = new ZamaFhevmProvider(providerType, fhevmEnv);
    await p.init();
    return p;
  }

  /**
   * Native urls abstract methods
   */

  public override get networkUrl(): string {
    return ZAMA_DEV_NETWORK_CONFIG.url;
  }

  public override get gatewayUrl(): string {
    return ZAMA_DEV_GATEWAY_URL;
  }

  /**
   * Balance abstract methods
   */

  public override async canSetBalance(): Promise<boolean> {
    return false;
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public batchSetBalance(addresses: Array<string>, amount: string): Promise<void> {
    throw new HardhatFhevmError("Operation not supported on Zama network.");
  }

  public override async coreDecryptBool(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<boolean> {
    const clear = await this.gatewayDecryptHandle(handle, contract, signer);
    return clear !== 0n;
  }

  public override async coreDecrypt4(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const clear = await this.gatewayDecryptHandle(handle, contract, signer);
    return clear;
  }

  public override async coreDecrypt8(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const clear = await this.gatewayDecryptHandle(handle, contract, signer);
    return clear;
  }

  public override async coreDecrypt16(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const clear = await this.gatewayDecryptHandle(handle, contract, signer);
    return clear;
  }

  public override async coreDecrypt32(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const clear = await this.gatewayDecryptHandle(handle, contract, signer);
    return clear;
  }

  public override async coreDecrypt64(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const clear = await this.gatewayDecryptHandle(handle, contract, signer);
    return clear;
  }

  public override async coreDecryptAddress(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<string> {
    const clear = await this.gatewayDecryptHandle(handle, contract, signer);
    return bigIntToAddress(clear);
  }
}

////////////////////////////////////////////////////////////////////////////////
