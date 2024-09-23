import { HardhatRuntimeEnvironment } from "hardhat/types";
import { HardhatFhevmInstance } from "../common/HardhatFhevmInstance";
import mock_fhevmjs from "./mock_fhevmjs";

export class MockFhevmInstance extends HardhatFhevmInstance {
  public get gatewayUrl(): string {
    return "";
  }
  public static async create(hre: HardhatRuntimeEnvironment): Promise<MockFhevmInstance> {
    const instance = await mock_fhevmjs.createInstance(hre);
    const i = new MockFhevmInstance();
    i.innerInstance = instance;
    return i;
  }
}
