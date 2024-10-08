import "@nomicfoundation/hardhat-ethers";
import assert from "assert";
import { ethers as EthersT } from "ethers";

import { HardhatFhevmError } from "../../error";
import { FhevmGatewayDecryptionDB } from "./FhevmGatewayDecryptionDB";
import { FhevmGatewayDecryption, FhevmGatewayDecryptionEvent, FhevmGatewayResultCallbackEvent } from "../types";
import { EthereumProvider } from "hardhat/types";
import { FhevmProvider } from "../FhevmProvider";

///////////////////////////////////////////////////////////////////////////////

export abstract class FhevmGatewayAsyncDecryptionsProcessor {
  // True by default, false in mock mode
  protected ___bug_version_0_7_1_skip_first_request: boolean = true;

  protected readonly provider: EthersT.Provider;
  protected readonly ethProvider: EthereumProvider;
  protected readonly fhevmProvider: FhevmProvider;

  protected readonly gatewayContract: EthersT.Contract;
  protected readonly isMock: boolean;

  private _gatewayContractAddress: string | undefined;

  private _eventResultCallbackInterface: EthersT.Interface;
  private _eventEventDecryptionInterface: EthersT.Interface;

  protected _requestIDDB: FhevmGatewayDecryptionDB;

  protected _nextBlockNumberToPoll: number | undefined;
  private _latestBlockNumberPolled: number | undefined;

  constructor(fhevmProvider: FhevmProvider, gatewayContract: EthersT.Contract) {
    this.fhevmProvider = fhevmProvider;
    this.gatewayContract = gatewayContract;

    this._eventResultCallbackInterface = new EthersT.Interface([
      "event ResultCallback(uint256 indexed requestID, bool success, bytes result)",
    ]);

    this._eventEventDecryptionInterface = new EthersT.Interface([
      "event EventDecryption(uint256 indexed requestID, uint256[] cts, address contractCaller, bytes4 callbackSelector, uint256 msgValue, uint256 maxTimestamp, bool passSignaturesToCaller)",
    ]);

    this._requestIDDB = new FhevmGatewayDecryptionDB();
    this.isMock = this.fhevmProvider.fhevmEnv.deployOptions.mock;
    this.provider = this.fhevmProvider.fhevmEnv.providerOrThrow;
    this.ethProvider = this.fhevmProvider.fhevmEnv.ethProviderOrThrow;
  }

  protected abstract tryDecrypt(requestIDs: bigint[]): Promise<void>;

  async init() {
    this._gatewayContractAddress = await this.gatewayContract.getAddress();
    this._nextBlockNumberToPoll = await this.getBlockNumber();

    await this._traceGatewayEvents();
  }

  protected getRequestIDsWithGreaterOrEqualBlockNumber(blockNum: number) {
    return this._requestIDDB.findWithGreaterOrEqualBlockNumber(blockNum);
  }

  protected getPendingRequestID(requestID: bigint): FhevmGatewayDecryptionEvent {
    //return this._pendingQueue.ids.get(requestID)!;
    return this._requestIDDB.getPendingRequest(requestID);
  }

  protected tryRevertToBlockNumber(blockNum: number) {
    if (!this.isMock) {
      throw new HardhatFhevmError(`Received a past block number ${blockNum}. Revert is only supported in mock mode.`);
    }

    const n_before = this._requestIDDB.count();

    // Remove all RequestIDs prior to blockNum
    this._requestIDDB.clearGreaterOrEqualToBlock(blockNum);

    const n_after = this._requestIDDB.count();

    // Revert blockNum variables
    this._latestBlockNumberPolled = blockNum - 1;
    this._nextBlockNumberToPoll = blockNum;

    this.logDim(`Revert to block ${blockNum} removed ${n_before - n_after} request ids`);
    this.logDim(`Revert to block ${blockNum} keeping ${n_after} past completed ids.`);
  }

  public async waitForAllAsyncDecryptions(): Promise<FhevmGatewayDecryption[]> {
    const res = await this._waitForAsyncDecryptions(undefined);
    return res;
  }

  public async waitForAsyncDecryptions(
    decryptionRequests: FhevmGatewayDecryptionEvent[],
  ): Promise<FhevmGatewayDecryption[]> {
    const res = await this._waitForAsyncDecryptions(decryptionRequests);
    return res;
  }

  private async _waitForAsyncDecryptions(
    decryptionRequests: FhevmGatewayDecryptionEvent[] | undefined,
  ): Promise<FhevmGatewayDecryption[]> {
    let currentBlockNumber = await this.getBlockNumber();

    if (this._latestBlockNumberPolled !== undefined && currentBlockNumber < this._latestBlockNumberPolled) {
      this.tryRevertToBlockNumber(currentBlockNumber);
    }

    if (this._latestBlockNumberPolled !== undefined && currentBlockNumber === this._latestBlockNumberPolled) {
      const n_pending = this._requestIDDB.countPending(decryptionRequests);
      if (n_pending === 0) {
        // Don't do anything, all decryptions are completed
        this.logDim(`[Block:${currentBlockNumber}] all decryptions are completed.`);
        return [];
      }

      this.logDim(`[Block:${currentBlockNumber}] still ${n_pending} pending request ids. Wait one block needed.`);
      await this._waitNBlocks(1);

      // For debug purpose
      const nextBlockNumber = await this.getBlockNumber();
      assert(nextBlockNumber === currentBlockNumber + 1);

      currentBlockNumber = nextBlockNumber;
    }

    const fromBlock = Math.min(this._nextBlockNumberToPoll ?? 0, currentBlockNumber);

    assert(fromBlock <= currentBlockNumber, `fromBlock=${fromBlock} currentBlockNumber=${currentBlockNumber}`);

    const poll = await this._pollBlocks(fromBlock, currentBlockNumber, decryptionRequests);

    this._latestBlockNumberPolled = poll.toBlock;
    this._nextBlockNumberToPoll = poll.toBlock + 1;

    return this._requestIDDB.getHardhatFhevmDecryptions(poll.requestIDs);
  }

  protected async getBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  private async _waitNBlocks(count: number) {
    await this.fhevmProvider.waitNBlocks(count);
  }

  private async _pollBlocks(
    fromBlock: number,
    currentBlock: number,
    decryptionRequests?: FhevmGatewayDecryptionEvent[],
  ): Promise<{ toBlock: number; requestIDs: bigint[] }> {
    let toBlock = currentBlock;
    assert(fromBlock <= toBlock);

    const startCurrentBlock = currentBlock;

    const requests = new Set<bigint>();

    if (!decryptionRequests) {
      this._requestIDDB.getPendingRequestIDs().forEach((rID) => requests.add(rID));
    }

    let poll_count = 0;

    while (poll_count < 100) {
      poll_count++;

      this.logDim(`[Poll count: ${poll_count} from:${fromBlock} to:${toBlock}]`);

      let newEvts;
      if (poll_count % 10 === 0) {
        // Something went wrong ?? try to repoll past blocks
        const repoll_start = Math.max(0, startCurrentBlock - 2);

        this.logDim(
          `[Re-poll from:${fromBlock} to:${toBlock}] Try to re-poll past blocks from: ${repoll_start} to: ${toBlock}.`,
        );

        newEvts = await this._queryGatewayEvents(repoll_start, toBlock);
      } else {
        newEvts = await this._queryGatewayEvents(fromBlock, toBlock);
      }

      if (!decryptionRequests) {
        newEvts.newRequests.forEach((rID) => requests.add(rID));
      }

      // list the pending request ids
      const pendingRequestIDs = this._requestIDDB.filterPendingRequestIDs(decryptionRequests);

      // No more pending request ids, the wait is completed.
      if (pendingRequestIDs.length === 0) {
        const requestIDs = decryptionRequests ? decryptionRequests.map((e) => e.requestID) : [...requests.keys()];

        // Check for debugging
        requestIDs.forEach((rID) => {
          assert(this._requestIDDB.isRequestIDDecrypted(rID));
        });

        this.logDim(
          `[from:${fromBlock} to:${toBlock}] All decryptions are completed (number of decryptions=${requestIDs.length}).`,
        );

        return { toBlock, requestIDs };
      }

      if (pendingRequestIDs.length === 1) {
        this.logDim(
          `[from:${fromBlock} to:${toBlock}] one pending request id=${pendingRequestIDs[0]}, wait one block...`,
        );
      } else {
        this.logDim(
          `[from:${fromBlock} to:${toBlock}] pending request id range=[${pendingRequestIDs[0]}-${pendingRequestIDs[pendingRequestIDs.length - 1]}], wait one block...`,
        );
      }

      // Try to decrypt instantly (mock mode)
      await this.tryDecrypt(pendingRequestIDs);

      // Wait 1 block before next poll
      await this._waitNBlocks(1);

      fromBlock = toBlock + 1;
      toBlock = await this.getBlockNumber();

      assert(toBlock >= fromBlock);
    }

    throw new HardhatFhevmError("Poll blocks failed");
  }

  private async _traceGatewayEvents() {
    // trace "EventDecryption"
    await this.gatewayContract!.on(
      this.gatewayContract!.getEvent("EventDecryption"),
      async (
        requestID,
        _cts,
        _contractCaller,
        _callbackSelector,
        _msgValue,
        _maxTimestamp,
        _passSignaturesToCaller,
        eventData,
      ) => {
        assert(eventData instanceof EthersT.ContractEventPayload);
        const blockNumber = eventData.log.blockNumber;
        this.logDim(
          `[Trace 'EventDecryption' event] ${this.currentTimeAsString} - Requested decrypt on block ${blockNumber} (requestID ${requestID})`,
        );
      },
    );

    // trace "ResultCallback"
    await this.gatewayContract!.on(
      this.gatewayContract!.getEvent("ResultCallback"),
      async (requestID, _success, _result, eventData) => {
        assert(eventData instanceof EthersT.ContractEventPayload);
        const blockNumber = eventData.log.blockNumber;
        this.logDim(
          `[Trace 'ResultCallback'  event] ${this.currentTimeAsString} - Fulfilled decrypt on block ${blockNumber} (requestID ${requestID})`,
        );
      },
    );
  }

  private async _queryGatewayEvents(
    fromBlock: number,
    toBlock: number,
  ): Promise<{ newResults: bigint[]; newRequests: bigint[] }> {
    const [newResults, newRequests] = await Promise.all([
      this._queryGatewayResultCallbackEvents(fromBlock, toBlock),
      this._queryGatewayEventDecryptionEvents(fromBlock, toBlock),
    ]);
    return { newResults, newRequests };
  }

  private async _queryGatewayResultCallbackEvents(fromBlock: number, toBlock: number): Promise<bigint[]> {
    const resultCallbackTopics = await this.gatewayContract!.filters.ResultCallback().getTopicFilter();
    const resultCallbackFilter = {
      address: this._gatewayContractAddress,
      fromBlock,
      toBlock,
      topics: resultCallbackTopics,
    };

    const newly_added_rIDs: bigint[] = [];

    const logs = await this.provider.getLogs(resultCallbackFilter);

    if (logs.length === 0) {
      this.logDim(
        `[Query 'ResultCallback'  from:${fromBlock} to:${toBlock}] no event, pending=${this._requestIDDB.countPending()}`,
      );

      return newly_added_rIDs;
    }

    for (let i = 0; i < logs.length; ++i) {
      const log: EthersT.Log = logs[i];

      const desc = this._eventResultCallbackInterface.parseLog(log)!;

      const evt: FhevmGatewayResultCallbackEvent = {
        blockNumber: log.blockNumber,
        address: log.address,
        txHash: log.transactionHash,
        requestID: EthersT.toBigInt(desc.args[0]), //ethers.BigNumberish
        success: desc.args[1], //boolean
        result: desc.args[2], //ethers.BytesLike
      };

      //this._____completedQueue.push(evt);

      const added = this._requestIDDB.pushResult(evt);
      if (added) {
        newly_added_rIDs.push(evt.requestID);
      }

      this.logDim(
        `[Query 'ResultCallback'  from:${fromBlock} to:${toBlock}] push requestID=${evt.requestID} blockNumber=${evt.blockNumber} success=${evt.success} pending=${this._requestIDDB.countPending()}`,
      );
    }

    return newly_added_rIDs;
  }

  private async _queryGatewayEventDecryptionEvents(fromBlock: number, toBlock: number): Promise<bigint[]> {
    const eventDecryptionTopics = await this.gatewayContract!.filters.EventDecryption().getTopicFilter();
    const eventDecryptionFilter = {
      address: this._gatewayContractAddress,
      fromBlock,
      toBlock,
      topics: eventDecryptionTopics,
    };

    const newly_added_rIDs: bigint[] = [];

    const logs = await this.provider.getLogs(eventDecryptionFilter);

    if (logs.length === 0) {
      this.logDim(
        `[Query 'EventDecryption' from:${fromBlock} to:${toBlock}] no event, pending=${this._requestIDDB.countPending()}`,
      );

      return newly_added_rIDs;
    }

    for (let i = 0; i < logs.length; ++i) {
      const log: EthersT.Log = logs[i];

      const desc = this._eventEventDecryptionInterface.parseLog(log)!;

      const evt: FhevmGatewayDecryptionEvent = {
        blockNumber: log.blockNumber,
        address: log.address,
        txHash: log.transactionHash,
        requestID: EthersT.toBigInt(desc.args[0]), //ethers.BigNumberish
        handles: desc.args[1], //ethers.BigNumberish[]
        contractCaller: desc.args[2], //ethers.AddressLike
        callbackSelector: desc.args[3], //ethers.BytesLike
        msgValue: desc.args[4], //ethers.BigNumberish
        maxTimestamp: desc.args[5], //ethers.BigNumberish
        passSignaturesToCaller: desc.args[6], //boolean
      };

      /*

      FHEVM: v0.7.1 = very first request of decryption always fails at the moment due to a gateway bug

      */
      if (evt.requestID === BigInt(0) && this.___bug_version_0_7_1_skip_first_request) {
        // Skipp first request because of bug
        this.logBox("Must skip requestID === 0 : Bug in version 0.7.1");
        continue;
      }

      const added = this._requestIDDB.pushRequest(evt);
      if (added) {
        newly_added_rIDs.push(evt.requestID);
      }

      this.logDim(
        `[Query 'EventDecryption' from:${fromBlock} to:${toBlock}] push requestID=${evt.requestID}, blockNumber=${evt.blockNumber} pending=${this._requestIDDB.countPending()}`,
      );
    }

    return newly_added_rIDs;
  }

  public async parseEventDecryptionEvents(logs: EthersT.Log[]): Promise<FhevmGatewayDecryptionEvent[]> {
    const evts: FhevmGatewayDecryptionEvent[] = [];
    for (let i = 0; i < logs.length; ++i) {
      const log = logs[i];
      const desc = this._eventEventDecryptionInterface.parseLog(log);
      if (!desc) {
        continue;
      }

      const evt: FhevmGatewayDecryptionEvent = {
        blockNumber: log.blockNumber,
        address: log.address,
        txHash: log.transactionHash,
        requestID: EthersT.toBigInt(desc.args[0]), //ethers.BigNumberish
        handles: desc.args[1], //ethers.BigNumberish[]
        contractCaller: desc.args[2], //ethers.AddressLike
        callbackSelector: desc.args[3], //ethers.BytesLike
        msgValue: desc.args[4], //ethers.BigNumberish
        maxTimestamp: desc.args[5], //ethers.BigNumberish
        passSignaturesToCaller: desc.args[6], //boolean
      };
      evts.push(evt);
      this._requestIDDB.pushRequest(evt);

      this.logDim(
        `[Tx 'EventDecryption' block:${log.blockNumber}] push requestID=${evt.requestID}, blockNumber=${evt.blockNumber} pending=${this._requestIDDB.countPending()}`,
      );
    }
    return evts;
  }

  protected logDim(message: string) {
    this.fhevmProvider.fhevmEnv.logDim(message);
  }
  protected logBox(message: string) {
    this.fhevmProvider.fhevmEnv.logBox(message);
  }
  private get currentTimeAsString(): string {
    const now = new Date();
    return now.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "numeric", second: "numeric" });
  }
}
