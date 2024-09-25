import { HardhatFhevmInstance } from "../common/HardhatFhevmInstance";
import mock_fhevmjs from "./mock_fhevmjs";
import { MockFhevmProvider } from "./MockFhevmProvider";

export class MockFhevmInstance extends HardhatFhevmInstance {
  public get gatewayUrl(): string {
    return "";
  }
  public static async create(fhevmProvider: MockFhevmProvider): Promise<MockFhevmInstance> {
    const instance = await mock_fhevmjs.createInstance(fhevmProvider);
    const i = new MockFhevmInstance();
    i.innerInstance = instance;
    return i;
  }
}
