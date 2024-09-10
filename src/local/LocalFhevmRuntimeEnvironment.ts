import { HardhatRuntimeEnvironment, HttpNetworkConfig } from "hardhat/types";
import {
  HardhatFhevmRuntimeEnvironment,
  FhevmRuntimeEnvironmentType,
  HardhatFhevmInstance,
} from "../common/HardhatFhevmRuntimeEnvironment";
import { readFileSync } from "fs";
import { getInstallPrivKeyFile } from "../common/dirs";
import fhevmjs from "fhevmjs/node";
import { HardhatFhevmError } from "../common/error";
import { LocalResultCallbackProcessor } from "./LocalResultCallbackProcessor";

interface FhevmjsDecryptor {
  decryptBool: (ciphertext: string) => boolean;
  decrypt4: (ciphertext: string) => number;
  decrypt8: (ciphertext: string) => number;
  decrypt16: (ciphertext: string) => number;
  decrypt32: (ciphertext: string) => number;
  decrypt64: (ciphertext: string) => bigint;
  decryptAddress: (ciphertext: string) => string;
}

export class LocalFhevmRuntimeEnvironment extends HardhatFhevmRuntimeEnvironment {
  private _fhevmjs_decryptor: FhevmjsDecryptor | undefined;

  constructor(hre: HardhatRuntimeEnvironment) {
    super(FhevmRuntimeEnvironmentType.Fhe, hre);
  }

  public async init(): Promise<void> {
    // const initialized = this._fhevmjs_decryptor && this._resultprocessor;
    // if (!initialized) {
    //   logTrace("initialize fhevm runtime.", this.hre.fhevm.logOptions());
    // }

    await super.init();

    // Could be called multiple times from the outside world
    if (!this._fhevmjs_decryptor) {
      const cks = readFileSync(getInstallPrivKeyFile(this.hre));
      this._fhevmjs_decryptor = fhevmjs.clientKeyDecryptor(cks);
    }

    // Could be called multiple times from the outside world
    if (!this._resultprocessor) {
      this._resultprocessor = new LocalResultCallbackProcessor(this.hre);
      await this._resultprocessor.init();
    }
  }

  private decryptor() {
    return this._fhevmjs_decryptor!;
  }

  public async createInstance(): Promise<LocalHardhatFhevmInstance> {
    return LocalHardhatFhevmInstance.create(this.hre);
  }

  private async getCiphertext(handle: bigint): Promise<string> {
    return this.hre.fhevm.hardhatProvider().call(fhevmjs.getCiphertextCallParams(handle));
  }

  public override async decryptBool(handle: bigint): Promise<boolean> {
    return this.decryptor().decryptBool(await this.getCiphertext(handle));
  }

  public override async decrypt4(handle: bigint): Promise<bigint> {
    return BigInt(this.decryptor().decrypt4(await this.getCiphertext(handle)));
  }

  public override async decrypt8(handle: bigint): Promise<bigint> {
    return BigInt(this.decryptor().decrypt8(await this.getCiphertext(handle)));
  }

  public override async decrypt16(handle: bigint): Promise<bigint> {
    return BigInt(this.decryptor().decrypt16(await this.getCiphertext(handle)));
  }

  public override async decrypt32(handle: bigint): Promise<bigint> {
    return BigInt(this.decryptor().decrypt32(await this.getCiphertext(handle)));
  }

  public override async decrypt64(handle: bigint): Promise<bigint> {
    return this.decryptor().decrypt64(await this.getCiphertext(handle));
  }

  public override async decryptAddress(handle: bigint): Promise<string> {
    return this.decryptor().decryptAddress(await this.getCiphertext(handle));
  }
}

export class LocalHardhatFhevmInstance extends HardhatFhevmInstance {
  public static async create(hre: HardhatRuntimeEnvironment): Promise<LocalHardhatFhevmInstance> {
    if ("url" in hre.network.config) {
      const http_config = hre.network.config as HttpNetworkConfig;
      const js_instance = await fhevmjs.createInstance({
        networkUrl: http_config.url,
        gatewayUrl: hre.fhevm.dockerServices().gatewayServiceUrl(),
      });
      const hh_instance = new LocalHardhatFhevmInstance();
      hh_instance.innerInstance = js_instance;
      return hh_instance;
    }
    throw new HardhatFhevmError("Unsupported network config");
  }
}
