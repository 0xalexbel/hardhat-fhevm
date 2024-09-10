import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  HardhatFhevmRuntimeEnvironment,
  FhevmRuntimeEnvironmentType,
  HardhatFhevmInstance,
} from "../common/HardhatFhevmRuntimeEnvironment";
import { MockFhevmCoProcessor } from "./MockFhevmCoProcessor";
import { bigIntToAddress } from "../common/utils";
import assert from "assert";
import mock_fhevmjs from "./mock_fhevmjs";
import { MockResultCallbackProcessor } from "./MockResultCallbackProcessor";
import { logTrace } from "../common/error";
import { ethers } from "ethers";

export class MockFhevmRuntimeEnvironment extends HardhatFhevmRuntimeEnvironment {
  private _coprocessor: MockFhevmCoProcessor | undefined;
  //private _resultprocessor: MockResultCallbackProcessor | undefined;

  constructor(hre: HardhatRuntimeEnvironment) {
    super(FhevmRuntimeEnvironmentType.Mock, hre);
  }

  public static get(hre: HardhatRuntimeEnvironment): MockFhevmRuntimeEnvironment | undefined {
    if (hre.fhevm.runtimeType() === FhevmRuntimeEnvironmentType.Mock) {
      assert(hre.fhevm instanceof MockFhevmRuntimeEnvironment);
      return hre.fhevm;
    }
    return undefined;
  }

  public async init(): Promise<void> {
    // const initialized = this._coprocessor && this._resultprocessor;
    // if (!initialized) {
    //   logTrace("initialize fhevm mock runtime.", this.hre.fhevm.logOptions());
    // }

    await super.init();

    // Could be called multiple times from the outside world
    if (!this._coprocessor) {
      this._coprocessor = new MockFhevmCoProcessor(this.hre);
      await this._coprocessor.init();
    }

    // Must be compiled!
    if (!this._resultprocessor) {
      this._resultprocessor = new MockResultCallbackProcessor(this.hre);
      await this._resultprocessor.init();
    }
  }

  private coprocessor() {
    return this._coprocessor!;
  }

  public async createInstance(): Promise<MockHardhatFhevmInstance> {
    return MockHardhatFhevmInstance.create(this.hre);
  }

  public async waitForCoprocessing() {
    const cop = this.coprocessor();
    await cop.wait();
  }

  public async queryClearText(handle: ethers.BigNumberish): Promise<bigint> {
    const cop = this.coprocessor();
    return cop.handleDB().queryClearTextFromBigInt(ethers.toBigInt(handle));
  }

  private async decryptBigInt(handle: bigint): Promise<bigint> {
    await this.waitForCoprocessing();
    return BigInt(await this.queryClearText(handle));
  }

  public override async decryptBool(handle: bigint): Promise<boolean> {
    const bn = await this.decryptBigInt(handle);
    return bn === BigInt(1);
  }

  public override async decrypt4(handle: bigint): Promise<bigint> {
    return this.decryptBigInt(handle);
  }

  public override async decrypt8(handle: bigint): Promise<bigint> {
    return this.decryptBigInt(handle);
  }

  public override async decrypt16(handle: bigint): Promise<bigint> {
    return this.decryptBigInt(handle);
  }

  public override async decrypt32(handle: bigint): Promise<bigint> {
    return this.decryptBigInt(handle);
  }

  public override async decrypt64(handle: bigint): Promise<bigint> {
    return this.decryptBigInt(handle);
  }

  public override async decryptAddress(handle: bigint): Promise<string> {
    await this.waitForCoprocessing();
    const addrBigInt = await this.queryClearText(handle);
    return bigIntToAddress(addrBigInt);
  }
}

export class MockHardhatFhevmInstance extends HardhatFhevmInstance {
  public static async create(hre: HardhatRuntimeEnvironment): Promise<MockHardhatFhevmInstance> {
    const instance = await mock_fhevmjs.createInstance(hre);
    const i = new MockHardhatFhevmInstance();
    i.innerInstance = instance;
    return i;
  }
}
