import { HardhatRuntimeEnvironment, HttpNetworkConfig } from "hardhat/types";
import { HardhatFhevmInstance } from "../common/HardhatFhevmInstance";
import fhevmjs from "fhevmjs/node";
import { HardhatFhevmError } from "../error";
import assert from "assert";

export class LocalFhevmInstance extends HardhatFhevmInstance {
  private _gatewayUrl: string | undefined;

  public get gatewayUrl(): string {
    assert(this._gatewayUrl);
    return this._gatewayUrl;
  }
  public static async create(hre: HardhatRuntimeEnvironment): Promise<LocalFhevmInstance> {
    if ("url" in hre.network.config) {
      const http_config = hre.network.config as HttpNetworkConfig;
      const gatewayUrl = hre.fhevm.dockerServices.gatewayServiceUrl();
      const js_instance = await fhevmjs.createInstance({
        networkUrl: http_config.url,
        gatewayUrl,
      });
      const hh_instance = new LocalFhevmInstance();
      hh_instance.innerInstance = js_instance;
      hh_instance._gatewayUrl = gatewayUrl;
      return hh_instance;
    }
    throw new HardhatFhevmError("Unsupported network config");
  }
}
