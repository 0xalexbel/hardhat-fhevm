import { HardhatFhevmInstance } from "../common/HardhatFhevmInstance";
import fhevmjs from "fhevmjs/node";
import assert from "assert";

export class LocalFhevmInstance extends HardhatFhevmInstance {
  private _gatewayUrl: string | undefined;

  public get gatewayUrl(): string {
    assert(this._gatewayUrl);
    return this._gatewayUrl;
  }

  public static async create(networkUrl: string, gatewayUrl: string): Promise<LocalFhevmInstance> {
    const js_instance = await fhevmjs.createInstance({
      networkUrl,
      gatewayUrl,
    });
    const hh_instance = new LocalFhevmInstance();
    hh_instance.innerInstance = js_instance;
    hh_instance._gatewayUrl = gatewayUrl;
    return hh_instance;
  }
}
