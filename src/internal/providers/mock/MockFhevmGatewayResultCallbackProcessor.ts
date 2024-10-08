import { ethers as EthersT } from "ethers";
import { MockFhevmProvider } from "./MockFhevmProvider";
import { FhevmGatewayAsyncDecryptionsProcessor } from "../../gateway/FhevmGatewayResultCallbackProcessor";
import { HardhatFhevmError } from "../../../error";
import { FhevmGatewayDecryptionEvent } from "../../types";
import { FhevmClearTextSolidityType, getHandleFhevmType } from "../../utils/handle";
import { MapID } from "../../gateway/FhevmGatewayDecryptionDB";

///////////////////////////////////////////////////////////////////////////////

export class MockFhevmGatewayResultCallbackProcessor extends FhevmGatewayAsyncDecryptionsProcessor {
  private _mockTriggeredRequestIDs: MapID<FhevmGatewayDecryptionEvent>;
  private _mockFhevmProvider: MockFhevmProvider;
  private _relayerWallet: EthersT.Wallet;

  constructor(mockFhevmProvider: MockFhevmProvider, gatewayContract: EthersT.Contract, relayerWallet: EthersT.Wallet) {
    super(mockFhevmProvider, gatewayContract);
    this._mockTriggeredRequestIDs = new MapID<FhevmGatewayDecryptionEvent>();
    this._mockFhevmProvider = mockFhevmProvider;
    this._relayerWallet = relayerWallet.connect(mockFhevmProvider.fhevmEnv.providerOrThrow);
    this.___bug_version_0_7_1_skip_first_request = false;
  }

  override async init() {
    await super.init();
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

  private async _mockTriggerEventDecryption(eventDecryption: FhevmGatewayDecryptionEvent) {
    // in mocked mode, we trigger the decryption fulfillment manually
    const gatewayContract = this.gatewayContract.connect(this._relayerWallet) as EthersT.Contract;
    if (!gatewayContract) {
      throw new HardhatFhevmError(`MockResultCallbackProcessor has not been initialized`);
    }
    if (!gatewayContract.runner) {
      throw new HardhatFhevmError(`MockResultCallbackProcessor has not been initialized`);
    }

    // first check tat all handles are allowed for decryption
    const isAllowedForDec = await this._mockFhevmProvider.batchIsAllowedForDecryption(eventDecryption.handles);

    if (!isAllowedForDec.every(Boolean)) {
      throw new HardhatFhevmError("Some handle is not authorized for decryption");
    }

    // Build "fulfillRequest" arguments
    const typesList = eventDecryption.handles.map((handle) => getHandleFhevmType(handle));
    const types = typesList.map((num) => FhevmClearTextSolidityType[num]);

    const values = await this._mockFhevmProvider.batchDecryptMockHandles(
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

    const abiCoder = new EthersT.AbiCoder();
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
