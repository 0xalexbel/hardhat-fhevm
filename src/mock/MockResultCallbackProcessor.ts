import { ethers as EthersT } from "ethers";
import { ResultCallbackProcessor, EventDecryptionEvent } from "../common/ResultCallbackProcessor";
import { FhevmClearTextSolidityType, getHandleFhevmType } from "../common/handle";
import { MockFhevmProvider } from "./MockFhevmProvider";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { MapID } from "../common/RequestIDDB";
import { getUserPackageNodeModulesDir, zamaGetContrat } from "../common/zamaContracts";
import { HardhatFhevmError } from "../error";
import { ZamaDev } from "../constants";

///////////////////////////////////////////////////////////////////////////////

export class MockResultCallbackProcessor extends ResultCallbackProcessor {
  private _acl: EthersT.Contract | undefined; //ACL | undefined;
  private _mockTriggeredRequestIDs: MapID<EventDecryptionEvent>;
  private _mockFhevmProvider: MockFhevmProvider;

  constructor(
    mockFhevmProvider: MockFhevmProvider,
    hre: HardhatRuntimeEnvironment & { __SOLIDITY_COVERAGE_RUNNING?: boolean },
  ) {
    super(hre);
    this._mockTriggeredRequestIDs = new MapID<EventDecryptionEvent>();
    this._mockFhevmProvider = mockFhevmProvider;
    this.___bug_version_0_7_1_skip_first_request = false;
  }

  override async init() {
    await super.init();

    const contractsRootDir = getUserPackageNodeModulesDir(this.hre.config);
    const provider = this.hre.ethers.provider;

    this._acl = await zamaGetContrat("ACL", contractsRootDir, ZamaDev, provider, this.hre);
  }

  protected override tryRevertToBlockNumber(blockNum: number) {
    const request_ids_to_remove = this.getRequestIDsWithGreaterOrEqualBlockNumber(blockNum);
    super.tryRevertToBlockNumber(blockNum);
    this._mockTriggeredRequestIDs.delete(request_ids_to_remove);
  }

  protected override async tryDecrypt(requestIDs: bigint[]) {
    for (let i = 0; i < requestIDs.length; ++i) {
      const pendingReq = this.getPendingRequestID(requestIDs[i])!;
      if (!this._mockTriggeredRequestIDs.has(pendingReq)) {
        this._mockTriggeredRequestIDs.push(pendingReq);
        await this._mockTriggerEventDecryption(pendingReq);
      }
    }
  }

  private async _mockTriggerEventDecryption(eventDecryption: EventDecryptionEvent) {
    // in mocked mode, we trigger the decryption fulfillment manually
    const acl = this._acl;
    if (!acl) {
      throw new HardhatFhevmError(`MockResultCallbackProcessor has not been initialized`);
    }
    const gatewayContract = this.gatewayContract?.connect(this.relayerWallet) as EthersT.Contract;
    if (!gatewayContract) {
      throw new HardhatFhevmError(`MockResultCallbackProcessor has not been initialized`);
    }

    // first check tat all handles are allowed for decryption
    const isAllowedForDec = await Promise.all(
      eventDecryption.handles.map(async (handle) => acl.allowedForDecryption(handle)),
    );

    if (!isAllowedForDec.every(Boolean)) {
      throw new HardhatFhevmError("Some handle is not authorized for decryption");
    }

    // Build "fulfillRequest" arguments
    const typesList = eventDecryption.handles.map((handle) => getHandleFhevmType(handle));
    const types = typesList.map((num) => FhevmClearTextSolidityType[num]);

    const values = await this._mockFhevmProvider.batchDecryptBigInt(
      eventDecryption.handles.map((v) => EthersT.toBigInt(v)),
    );

    // await this.mockRuntime().waitForCoprocessing();
    // const values = await Promise.all(
    //   eventDecryption.handles.map(async (handle) => BigInt(await this.mockRuntime().queryClearText(handle))),
    // );

    // // first check tat all handles are allowed for decryption
    // const isAllowedForDec = await Promise.all(
    //   eventDecryption.handles.map(async (handle) => acl.allowedForDecryption(handle)),
    // );

    // if (!isAllowedForDec.every(Boolean)) {
    //   throw new HardhatFhevmError("Some handle is not authorized for decryption");
    // }

    // // Build "fulfillRequest" arguments
    // const typesList = eventDecryption.handles.map((handle) => getHandleFhevmType(handle));
    // const types = typesList.map((num) => FhevmClearTextSolidityType[num]);

    // const values = await Promise.all(
    //   eventDecryption.handles.map(async (handle) => BigInt(await this.mockRuntime().queryClearText(handle))),
    // );
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
    const tx = await gatewayContract.fulfillRequest(eventDecryption.requestID, calldata, [], {
      value: eventDecryption.msgValue,
    });
    await tx.wait();

    this.logDim(`Mock call: gatewayContract.fulfillRequest(${eventDecryption.requestID}) completed.`);
  }
}
