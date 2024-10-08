import { AddressLike, Signer, Wallet } from "ethers";
import {
  FhevmjsZKInput,
  HardhatFhevmGateway,
  HardhatFhevmRuntimeCapabilities,
  HardhatFhevmRuntimeEnvironment,
  HardhatFhevmRuntimeHelpers,
  HardhatFhevmRuntimeLogOptions,
} from "../types";
import { FhevmEnvironment } from "./FhevmEnvironment";
import fhevmjs from "fhevmjs/node";
import { bigIntToBytes } from "./utils/eth_utils";

export class FhevmAPIGateway implements HardhatFhevmGateway {
  private fhevmEnv: FhevmEnvironment;

  constructor(fhevmEnv: FhevmEnvironment) {
    this.fhevmEnv = fhevmEnv;
  }

  get relayerWallet(): Wallet {
    return this.fhevmEnv.gatewayRelayerWallet;
  }

  async waitForAllAsyncDecryptions(): Promise<void> {
    const p = await this.fhevmEnv.getFhevmProvider();
    await p.waitForAllGatewayAsyncDecryptions();
  }
}

export class FhevmAPIHelpers implements HardhatFhevmRuntimeHelpers {
  private fhevmEnv: FhevmEnvironment;

  constructor(fhevmEnv: FhevmEnvironment) {
    this.fhevmEnv = fhevmEnv;
  }

  bigIntToUint8Array(value: bigint): Uint8Array {
    return bigIntToBytes(value);
  }

  async waitNBlocks(count: number): Promise<void> {
    const p = await this.fhevmEnv.getFhevmProvider();
    await p.waitNBlocks(count);
  }
}

/**
 * Public API
 */
export class FhevmAPIWrapper implements HardhatFhevmRuntimeEnvironment {
  private fhevmEnv: FhevmEnvironment;
  private gatewayAPI: FhevmAPIGateway;
  private helpersAPI: FhevmAPIHelpers;

  constructor(fhevmEnv: FhevmEnvironment) {
    this.fhevmEnv = fhevmEnv;
    this.gatewayAPI = new FhevmAPIGateway(fhevmEnv);
    this.helpersAPI = new FhevmAPIHelpers(fhevmEnv);
  }

  async getCapabilities(): Promise<HardhatFhevmRuntimeCapabilities> {
    const o = this.fhevmEnv.deployOptions;
    const caps: HardhatFhevmRuntimeCapabilities = {
      supportsEBytes256: true,
      supportsAsyncDecryption: false,
      rpcMethods: {
        evmRevert: false,
        evmSnapshot: false,
      },
    };
    if (o.mock && o.mockOnChainDecrypt) {
      caps.supportsEBytes256 = false;
    }
    const rpc_methods = await this.fhevmEnv.getProviderRpcMethods();
    caps.rpcMethods.evmRevert = rpc_methods.evmRevert !== undefined;
    caps.rpcMethods.evmSnapshot = rpc_methods.evmSnapshot !== undefined;

    const fhevmProvider = await this.fhevmEnv.getFhevmProvider();
    caps.supportsAsyncDecryption = fhevmProvider.supportsGatewayAsyncDecryption;

    return caps;
  }

  get gateway(): HardhatFhevmGateway {
    return this.gatewayAPI;
  }

  get helpers(): HardhatFhevmRuntimeHelpers {
    return this.helpersAPI;
  }

  public async createInstance(): Promise<fhevmjs.FhevmInstance> {
    const fhevmProvider = await this.fhevmEnv.getFhevmProvider();
    const instance = await fhevmProvider.createInstance();
    return instance;
  }

  public async createEncryptedInput(contractAddress: AddressLike, userAddress: string): Promise<FhevmjsZKInput> {
    const fhevmProvider = await this.fhevmEnv.getFhevmProvider();
    const einput = await fhevmProvider.createEncryptedInput(contractAddress, userAddress);
    return einput;
  }

  public async decrypt64(handle: bigint, contract: AddressLike, signer: Signer): Promise<bigint> {
    const fhevmProvider = await this.fhevmEnv.getFhevmProvider();
    const res = fhevmProvider.decrypt64(handle, contract, signer);
    return res;
  }

  get logOptions(): HardhatFhevmRuntimeLogOptions {
    return this.fhevmEnv.logOptions;
  }

  set logOptions(value: HardhatFhevmRuntimeLogOptions) {
    this.fhevmEnv.logOptions = value;
  }
}
