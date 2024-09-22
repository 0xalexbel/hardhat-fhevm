import { HardhatRuntimeEnvironment, HttpNetworkConfig } from "hardhat/types";
import { HardhatFhevmInstance } from "../common/HardhatFhevmInstance";
import fhevmjs from "fhevmjs/node";
import { HardhatFhevmError } from "../error";
import { ZAMA_DEV_GATEWAY_URL } from "../constants";

export class ZamaFhevmInstance extends HardhatFhevmInstance {
  public get gatewayUrl(): string {
    return ZAMA_DEV_GATEWAY_URL;
  }
  public static async create(hre: HardhatRuntimeEnvironment): Promise<ZamaFhevmInstance> {
    if ("url" in hre.network.config) {
      const http_config = hre.network.config as HttpNetworkConfig;
      const js_instance = await fhevmjs.createInstance({
        networkUrl: http_config.url,
        gatewayUrl: ZAMA_DEV_GATEWAY_URL,
      });
      const hh_instance = new ZamaFhevmInstance();
      hh_instance.innerInstance = js_instance;
      return hh_instance;
    }
    throw new HardhatFhevmError("Unsupported network config");
  }
}
