import assert from "assert";
import { ethers } from "ethers";
import { ResultCallbackProcessor, EventDecryptionEvent } from "../common/ResultCallbackProcessor";
import { FhevmClearTextSolidityType, getHandleFhevmType } from "../common/handle";
import { MockFhevmRuntimeEnvironment } from "./MockFhevmRuntimeEnvironment";
import { FhevmRuntimeEnvironmentType } from "../common/HardhatFhevmRuntimeEnvironment";
import { HardhatFhevmError } from "../common/error";
import { getMockACL } from "../common/contracts";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { MapID } from "../common/RequestIDDB";

///////////////////////////////////////////////////////////////////////////////

export class MockResultCallbackProcessor extends ResultCallbackProcessor {
  private acl: ethers.Contract | undefined; //ACL | undefined;
  private mockTriggeredRequestIDs: MapID<EventDecryptionEvent>;

  constructor(hre: HardhatRuntimeEnvironment & { __SOLIDITY_COVERAGE_RUNNING?: boolean }) {
    super(hre);
    this.mockTriggeredRequestIDs = new MapID<EventDecryptionEvent>();
  }

  override async init() {
    await super.init();
    this.acl = await getMockACL(this.hre);
    assert(!this.hre.fhevm.isConfliting());
  }

  private mockRuntime(): MockFhevmRuntimeEnvironment {
    if (this.hre.fhevm.runtimeType() === FhevmRuntimeEnvironmentType.Mock) {
      assert(this.hre.fhevm instanceof MockFhevmRuntimeEnvironment);
      return this.hre.fhevm;
    }
    throw new HardhatFhevmError("Unexpected runtime type");
  }

  protected override tryRevertToBlockNumber(blockNum: number) {
    const request_ids_to_remove = this.getRequestIDsWithGreaterOrEqualBlockNumber(blockNum);
    super.tryRevertToBlockNumber(blockNum);
    this.mockTriggeredRequestIDs.delete(request_ids_to_remove);
  }

  protected override async tryDecrypt(requestIDs: bigint[]) {
    for (let i = 0; i < requestIDs.length; ++i) {
      const pendingReq = this.getPendingRequestID(requestIDs[i])!;
      if (!this.mockTriggeredRequestIDs.has(pendingReq)) {
        this.mockTriggeredRequestIDs.push(pendingReq);
        await this._mockTriggerEventDecryption(pendingReq);
      }
    }
  }

  private async _mockTriggerEventDecryption(eventDecryption: EventDecryptionEvent) {
    // in mocked mode, we trigger the decryption fulfillment manually

    await this.mockRuntime().waitForCoprocessing();

    // first check tat all handles are allowed for decryption
    const isAllowedForDec = await Promise.all(
      eventDecryption.handles.map(async (handle) => this.acl!.allowedForDecryption(handle)),
    );

    if (!isAllowedForDec.every(Boolean)) {
      throw new Error("Some handle is not authorized for decryption");
    }

    // Build "fulfillRequest" arguments
    const typesList = eventDecryption.handles.map((handle) => getHandleFhevmType(handle));
    const types = typesList.map((num) => FhevmClearTextSolidityType[num]);

    const values = await Promise.all(
      eventDecryption.handles.map(async (handle) => BigInt(await this.mockRuntime().queryClearText(handle))),
    );
    const valuesFormatted = values.map((value, index) =>
      types[index] === "address" ? "0x" + value.toString(16).padStart(40, "0") : value,
    );
    const valuesFormatted2 = valuesFormatted.map((value, index) =>
      types[index] === "bytes" ? "0x" + value.toString(16).padStart(512, "0") : value,
    );

    const abiCoder = new this.hre.ethers.AbiCoder();
    // 31 is just a dummy uint256 requestID to get correct abi encoding for the remaining arguments (i.e everything except the requestID)
    const encodedData = abiCoder.encode(["uint256", ...types], [31, ...valuesFormatted2]);
    // we just pop the dummy requestID to get the correct value to pass for `decryptedCts`
    const calldata = "0x" + encodedData.slice(66);

    this.logDim(`Mock calling: gatewayContract.fulfillRequest(${eventDecryption.requestID})...`);

    // Call "fulfillRequest" manually
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    //@ts-ignore
    const tx = await this.gatewayContract!.connect(this.relayerWallet).fulfillRequest(
      eventDecryption.requestID,
      calldata,
      [],
      {
        value: eventDecryption.msgValue,
      },
    );
    await tx.wait();

    this.logDim(`Mock call: gatewayContract.fulfillRequest(${eventDecryption.requestID}) completed.`);
  }
}
