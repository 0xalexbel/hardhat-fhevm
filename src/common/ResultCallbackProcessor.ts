import "@nomicfoundation/hardhat-ethers";
import assert from "assert";
import { ethers } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getGatewayContract } from "./contracts";
import { currentTime } from "./utils";
import { HardhatFhevmError, logBox, logDim } from "./error";
import { waitNBlocks } from "./wait";
import { RequestIDDB } from "./RequestIDDB";
import { HardhatFhevmDecryption } from "../types";

///////////////////////////////////////////////////////////////////////////////

export type ResultCallbackEvent = {
  address: string;
  blockNumber: number;
  txHash: string;
  requestID: bigint;
  success: boolean;
  result: ethers.BytesLike;
};

export type EventDecryptionEvent = {
  address: string;
  blockNumber: number;
  txHash: string;
  requestID: bigint;
  handles: ethers.BigNumberish[]; //cts
  contractCaller: ethers.AddressLike;
  callbackSelector: ethers.BytesLike;
  msgValue: ethers.BigNumberish;
  maxTimestamp: ethers.BigNumberish;
  passSignaturesToCaller: boolean;
};

///////////////////////////////////////////////////////////////////////////////

export abstract class ResultCallbackProcessor {
  protected hre: HardhatRuntimeEnvironment & { __SOLIDITY_COVERAGE_RUNNING?: boolean };
  protected gatewayContract: ethers.Contract | undefined; //GatewayContract | undefined;
  private gatewayContractAddress: string | undefined;
  protected relayerWallet: ethers.Wallet;
  private eventResultCallbackInterface: ethers.Interface;
  private eventEventDecryptionInterface: ethers.Interface;

  // private _____completedQueue: RequestIDQueue<ResultCallbackEvent>;
  // private _____pendingQueue: RequestIDQueue<EventDecryptionEvent>;
  protected _requestIDDB: RequestIDDB;

  protected _nextBlockNumberToPoll: number | undefined;
  private _latestBlockNumberPolled: number | undefined;

  constructor(hre: HardhatRuntimeEnvironment & { __SOLIDITY_COVERAGE_RUNNING?: boolean }) {
    this.hre = hre;
    this.relayerWallet = this.hre.fhevm.gatewayRelayerWallet();

    this.eventResultCallbackInterface = new hre.ethers.Interface([
      "event ResultCallback(uint256 indexed requestID, bool success, bytes result)",
    ]);

    this.eventEventDecryptionInterface = new hre.ethers.Interface([
      "event EventDecryption(uint256 indexed requestID, uint256[] cts, address contractCaller, bytes4 callbackSelector, uint256 msgValue, uint256 maxTimestamp, bool passSignaturesToCaller)",
    ]);

    // this._____completedQueue = new RequestIDQueue<ResultCallbackEvent>();
    // this._____pendingQueue = new RequestIDQueue<EventDecryptionEvent>();
    this._requestIDDB = new RequestIDDB();
  }

  async init() {
    // Must have been compiled first!
    this.gatewayContract = await getGatewayContract(this.hre);
    this.gatewayContractAddress = await this.gatewayContract.getAddress();
    this._nextBlockNumberToPoll = await this.getBlockNumber();

    await this._traceGatewayEvents();
  }

  // protected countPending_v1() {
  //   // the pending queue cannot contain less ids than the completed queue
  //   assert(this._pendingQueue.ids.size >= this._completedQueue.ids.size);

  //   if (this._pendingQueue.max_id === this._completedQueue.max_id) {
  //     assert(
  //       this._pendingQueue.ids.size === this._completedQueue.ids.size,
  //       `max_id=${this._pendingQueue.max_id} pending.size=${this._pendingQueue.ids.size} completed.size=${this._completedQueue.ids.size}`,
  //     );
  //     return BigInt(0);
  //   }

  //   if (this._pendingQueue.max_id === undefined) {
  //     assert(this._completedQueue.max_id === undefined);
  //     assert(this._pendingQueue.ids.size === this._completedQueue.ids.size);
  //     return BigInt(0);
  //   }

  //   if (this._completedQueue.max_id === undefined) {
  //     // nothing is completed
  //     // the number of pending requests is equal to the size of the pending queue
  //     return this._pendingQueue.length();
  //   }

  //   const count = this._pendingQueue.max_id - this._completedQueue.max_id;
  //   assert(count >= BigInt(0));

  //   return count;
  // }

  // protected getCurrentPendingRange() {
  //   const n = this.countPending();
  //   if (n === BigInt(0)) {
  //     return undefined;
  //   }
  //   const to = this._pendingQueue.max_id!;
  //   const from =
  //     this._completedQueue.max_id === undefined ? this._pendingQueue.min_id! : this._completedQueue.max_id + BigInt(1);
  //   assert(from <= to);
  //   assert(to - from + BigInt(1) === n);

  //   const range = [];
  //   for (let i = from; i <= to; ++i) {
  //     range.push(i);
  //   }
  //   return range;
  // }

  private getCurrentPendingRange() {
    return this._requestIDDB.getWaitingForResult();
  }

  protected getRequestIDsWithGreaterOrEqualBlockNumber(blockNum: number) {
    return this._requestIDDB.findWithGreaterOrEqualBlockNumber(blockNum);
  }
  protected getPendingRequestID(requestID: bigint): EventDecryptionEvent {
    //return this._pendingQueue.ids.get(requestID)!;
    return this._requestIDDB.getPendingRequest(requestID);
  }

  protected tryRevertToBlockNumber(blockNum: number) {
    if (!this.hre.fhevm.isMock()) {
      throw new HardhatFhevmError(`Received a past block number ${blockNum}. Revert is only supported in mock mode.`);
    }

    const n_before = this._requestIDDB.count();

    // Remove all RequestIDs prior to blockNum
    this._requestIDDB.clearGreaterOrEqualToBlock(blockNum);

    const n_after = this._requestIDDB.count();

    // Revert blockNum variables
    this._latestBlockNumberPolled = blockNum - 1;
    this._nextBlockNumberToPoll = blockNum;

    logDim(`Revert to block ${blockNum} removed ${n_before - n_after} request ids`);
    logDim(`Revert to block ${blockNum} keeping ${n_after} past completed ids.`);
  }

  public async waitForDecryptions(decryptionRequests?: EventDecryptionEvent[]): Promise<HardhatFhevmDecryption[]> {
    let currentBlockNumber = await this.getBlockNumber();

    if (this._latestBlockNumberPolled !== undefined && currentBlockNumber < this._latestBlockNumberPolled) {
      this.tryRevertToBlockNumber(currentBlockNumber);
    }

    if (this._latestBlockNumberPolled !== undefined && currentBlockNumber === this._latestBlockNumberPolled) {
      const n_pending = this._requestIDDB.countPending(decryptionRequests);
      if (n_pending === 0) {
        // Don't do anything, all decryptions are completed
        logDim(`[Block:${currentBlockNumber}] all decryptions are completed.`);
        return [];
      }

      logDim(`[Block:${currentBlockNumber}] still ${n_pending} pending request ids. Wait one block needed.`);
      await waitNBlocks(1, this.hre);

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

  protected provider(): ethers.Provider {
    return this.hre.fhevm.provider();
  }

  protected async getBlockNumber(): Promise<number> {
    return this.hre.fhevm.provider().getBlockNumber();
  }

  private async _pollBlocks(
    fromBlock: number,
    currentBlock: number,
    decryptionRequests?: EventDecryptionEvent[],
  ): Promise<{ toBlock: number; requestIDs: bigint[] }> {
    let toBlock = currentBlock;
    assert(fromBlock <= toBlock);

    const requests = new Set<bigint>();

    if (!decryptionRequests) {
      this._requestIDDB.getPendingRequestIDs().forEach((rID) => requests.add(rID));
    }

    /* eslint-disable no-constant-condition */
    while (true) {
      const newEvts = await this._queryGatewayEvents(fromBlock, toBlock);

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

        logDim(
          `[from:${fromBlock} to:${toBlock}] All decryptions are completed (number of decryptions=${requestIDs.length}).`,
        );

        return { toBlock, requestIDs };
      }

      if (pendingRequestIDs.length === 1) {
        logDim(`[from:${fromBlock} to:${toBlock}] one pending request id=${pendingRequestIDs[0]}, wait one block...`);
      } else {
        logDim(
          `[from:${fromBlock} to:${toBlock}] pending request id range=[${pendingRequestIDs[0]}-${pendingRequestIDs[pendingRequestIDs.length - 1]}], wait one block...`,
        );
      }

      // Try to decrypt instantly (mock mode)
      await this.tryDecrypt(pendingRequestIDs);

      // Wait 1 block before next poll
      await waitNBlocks(1, this.hre);

      fromBlock = toBlock + 1;
      toBlock = await this.getBlockNumber();

      assert(toBlock >= fromBlock);
    }
  }

  protected abstract tryDecrypt(requestIDs: bigint[]): Promise<void>;

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
        assert(eventData instanceof ethers.ContractEventPayload);
        const blockNumber = eventData.log.blockNumber;
        logDim(
          `[EventDecryption event] ${currentTime()} - Requested decrypt on block ${blockNumber} (requestID ${requestID})`,
        );
      },
    );

    // trace "ResultCallback"
    await this.gatewayContract!.on(
      this.gatewayContract!.getEvent("ResultCallback"),
      async (requestID, _success, _result, eventData) => {
        assert(eventData instanceof ethers.ContractEventPayload);
        const blockNumber = eventData.log.blockNumber;
        logDim(
          `[ResultCallback event] ${currentTime()} - Fulfilled decrypt on block ${blockNumber} (requestID ${requestID})`,
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
      address: this.gatewayContractAddress,
      fromBlock,
      toBlock,
      topics: resultCallbackTopics,
    };

    const newly_added_rID: bigint[] = [];

    const logs = await this.provider().getLogs(resultCallbackFilter);

    for (let i = 0; i < logs.length; ++i) {
      const log: ethers.Log = logs[i];

      const desc = this.eventResultCallbackInterface.parseLog(log)!;

      const evt: ResultCallbackEvent = {
        blockNumber: log.blockNumber,
        address: log.address,
        txHash: log.transactionHash,
        requestID: ethers.toBigInt(desc.args[0]), //ethers.BigNumberish
        success: desc.args[1], //boolean
        result: desc.args[2], //ethers.BytesLike
      };

      //this._____completedQueue.push(evt);

      const added = this._requestIDDB.pushResult(evt);
      if (added) {
        newly_added_rID.push(evt.requestID);
      }

      logDim(
        `[from:${fromBlock} to:${toBlock}] completedQueue push id=${evt.requestID} blockNumber=${evt.blockNumber} success=${evt.success} pending=${this._requestIDDB.countPending()}`,
      );
    }

    return newly_added_rID;
  }

  private async _queryGatewayEventDecryptionEvents(fromBlock: number, toBlock: number): Promise<bigint[]> {
    const eventDecryptionTopics = await this.gatewayContract!.filters.EventDecryption().getTopicFilter();
    const eventDecryptionFilter = {
      address: this.gatewayContractAddress,
      fromBlock,
      toBlock,
      topics: eventDecryptionTopics,
    };

    const newly_added_rIDs: bigint[] = [];

    const logs = await this.provider().getLogs(eventDecryptionFilter);

    for (let i = 0; i < logs.length; ++i) {
      const log: ethers.Log = logs[i];

      const desc = this.eventEventDecryptionInterface.parseLog(log)!;

      const evt: EventDecryptionEvent = {
        blockNumber: log.blockNumber,
        address: log.address,
        txHash: log.transactionHash,
        requestID: ethers.toBigInt(desc.args[0]), //ethers.BigNumberish
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
      if (evt.requestID === BigInt(0)) {
        // Skipp first request because of bug
        logBox("Must skip requestID === 0 : Bug in version 0.7.1");
        continue;
      }

      const added = this._requestIDDB.pushRequest(evt);
      if (added) {
        newly_added_rIDs.push(evt.requestID);
      }

      logDim(
        `[from:${fromBlock} to:${toBlock}] pendingQueue push id=${evt.requestID}, blockNumber=${evt.blockNumber} pending=${this._requestIDDB.countPending()}`,
      );
    }

    return newly_added_rIDs;
  }

  public async parseEventDecryptionEvents(logs: ethers.Log[]): Promise<EventDecryptionEvent[]> {
    const evts: EventDecryptionEvent[] = [];
    for (let i = 0; i < logs.length; ++i) {
      const log = logs[i];
      const desc = this.eventEventDecryptionInterface.parseLog(log);
      if (!desc) {
        continue;
      }

      const evt: EventDecryptionEvent = {
        blockNumber: log.blockNumber,
        address: log.address,
        txHash: log.transactionHash,
        requestID: ethers.toBigInt(desc.args[0]), //ethers.BigNumberish
        handles: desc.args[1], //ethers.BigNumberish[]
        contractCaller: desc.args[2], //ethers.AddressLike
        callbackSelector: desc.args[3], //ethers.BytesLike
        msgValue: desc.args[4], //ethers.BigNumberish
        maxTimestamp: desc.args[5], //ethers.BigNumberish
        passSignaturesToCaller: desc.args[6], //boolean
      };
      evts.push(evt);
      this._requestIDDB.pushRequest(evt);
      logDim(
        `[from:${log.blockNumber} to:${log.blockNumber}] pendingQueue push id=${evt.requestID}, blockNumber=${evt.blockNumber} pending=${this._requestIDDB.countPending()}`,
      );
    }
    return evts;
  }
}
