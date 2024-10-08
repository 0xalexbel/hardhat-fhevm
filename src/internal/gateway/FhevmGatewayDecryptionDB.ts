import assert from "assert";
import { ethers } from "ethers";
import { HardhatFhevmInternalError } from "../../error";
import { FhevmGatewayDecryption, FhevmGatewayDecryptionEvent, FhevmGatewayResultCallbackEvent } from "../types";

export class MapID<T extends { requestID: bigint }> {
  public ids: Map<bigint, T>;
  public min_id: bigint | undefined;
  public max_id: bigint | undefined;

  constructor() {
    this.ids = new Map<bigint, T>();
  }

  private _updateMinMaxId(id: bigint) {
    if (this.max_id === undefined) {
      assert(this.min_id === undefined);
      this.max_id = id;
      this.min_id = id;
    } else {
      assert(this.min_id !== undefined);

      if (id > this.max_id) {
        this.max_id = id;
      }

      if (id < this.min_id) {
        this.min_id = id;
      }

      assert(this.min_id <= this.max_id);
    }
  }

  public push(v: T) {
    const id = v.requestID;
    assert(id >= 0);

    const existingV = this.ids.get(id);
    if (existingV) {
      return;
    }

    this.ids.set(id, v);
    this._updateMinMaxId(v.requestID);
  }

  public count() {
    return this.ids.size;
  }

  public has(t: T) {
    return this.ids.has(t.requestID);
  }

  public update() {
    this.max_id = undefined;
    this.min_id = undefined;
    this.ids.forEach((t) => this._updateMinMaxId(t.requestID));
  }

  public delete(requestIDs: bigint[]) {
    requestIDs.forEach((rID) => this.ids.delete(rID));
    this.update();
  }
}

type RequestIDEntry = {
  requestID: bigint;
  request?: {
    address: string;
    blockNumber: number;
    txHash: string;
    handles: bigint[]; //cts
    contractCaller: string;
    callbackSelector: string;
    msgValue: bigint;
    maxTimestamp: bigint;
    passSignaturesToCaller: boolean;
  };
  result?: {
    address: string;
    blockNumber: number;
    txHash: string;
    success: boolean;
    result: string;
  };
};

/**
 * Gateway decryption database storing request ids.
 */
export class FhevmGatewayDecryptionDB extends MapID<RequestIDEntry> {
  private handles: Map<bigint, bigint[]>;
  private waitingForResult: Set<bigint>;
  private waitingForRequest: Set<bigint>;

  constructor() {
    super();
    this.handles = new Map<bigint, bigint[]>();
    this.waitingForRequest = new Set<bigint>();
    this.waitingForResult = new Set<bigint>();
  }

  public pushRequest(e: FhevmGatewayDecryptionEvent): boolean {
    assert(ethers.isHexString(e.callbackSelector));
    assert(ethers.isAddress(e.contractCaller));

    const handles = e.handles.map((h) => ethers.toBigInt(h));

    const entry = this.ids.get(e.requestID);
    if (entry) {
      if (!entry.request) {
        assert(!this.waitingForResult.has(e.requestID));
        assert(this.waitingForRequest.has(e.requestID));
        this.waitingForRequest.delete(e.requestID);

        // poll results first and requests second.
        entry.request = {
          address: e.address,
          blockNumber: e.blockNumber,
          txHash: e.txHash,
          handles,
          contractCaller: e.contractCaller,
          callbackSelector: e.callbackSelector,
          msgValue: ethers.toBigInt(e.msgValue),
          maxTimestamp: ethers.toBigInt(e.maxTimestamp),
          passSignaturesToCaller: e.passSignaturesToCaller,
        };

        return true;
      }

      // First: call transaction TX, wait for TX receipt, parse TX receipt logs and store request id in DB
      // Then: poll for requests on a block range that includes the previous transaction TX's block, parse receipt logs then store all the request ids in DB
      // The TX transaction request id should already be stored!
      assert(this.equalRequest(e, this.ids.get(e.requestID)!));

      return false;
    }

    assert(!this.waitingForRequest.has(e.requestID));
    assert(!this.waitingForResult.has(e.requestID));
    this.waitingForResult.add(e.requestID);

    this.push({
      requestID: e.requestID,
      request: {
        address: e.address,
        blockNumber: e.blockNumber,
        txHash: e.txHash,
        handles,
        contractCaller: e.contractCaller,
        callbackSelector: e.callbackSelector,
        msgValue: ethers.toBigInt(e.msgValue),
        maxTimestamp: ethers.toBigInt(e.maxTimestamp),
        passSignaturesToCaller: e.passSignaturesToCaller,
      },
      result: undefined,
    });

    for (let i = 0; i < handles.length; ++i) {
      const handle = handles[i];
      const handle_to_request_ids = this.handles.get(handle);
      if (handle_to_request_ids) {
        // Handle can be listed mutliple times per requestID (see mixed sample)
        if (!handle_to_request_ids.includes(e.requestID)) {
          handle_to_request_ids.push(e.requestID);
        }
        assert(this.handles.get(handle)!.includes(e.requestID));
      } else {
        this.handles.set(handle, [e.requestID]);
      }
    }

    return true;
  }

  public isRequestIDDecrypted(requestID: ethers.BigNumberish): boolean {
    const id = ethers.getBigInt(requestID);
    const entry = this.ids.get(id);
    if (!entry) {
      return false;
    }
    if (!entry.result) {
      return false;
    }
    return entry.result.success;
  }

  public isHandleDecrypted(
    handle: ethers.BigNumberish,
    requestID?: ethers.BigNumberish | ethers.BigNumberish[],
  ): boolean {
    const h = ethers.toBigInt(handle);
    const handle_to_request_ids = this.handles.get(h);
    if (!handle_to_request_ids) {
      return false;
    }

    if (Array.isArray(requestID)) {
      for (let i = 0; i < requestID.length; ++i) {
        const id = ethers.toBigInt(requestID[i]);
        if (!handle_to_request_ids.includes(id)) {
          continue;
        }

        if (this.isRequestIDDecrypted(id)) {
          return true;
        }
      }

      return false;
    } else if (requestID !== undefined) {
      const id = ethers.toBigInt(requestID);
      if (!handle_to_request_ids.includes(id)) {
        return false;
      }
      return this.isRequestIDDecrypted(requestID);
    } else if (requestID === undefined) {
      for (let i = 0; i < handle_to_request_ids.length; ++i) {
        const id = handle_to_request_ids[i];
        if (this.isRequestIDDecrypted(id)) {
          return true;
        }
      }

      return false;
    }

    return false;
  }

  public pushResult(e: FhevmGatewayResultCallbackEvent): boolean {
    const entry = this.ids.get(e.requestID);

    assert(ethers.isHexString(e.result));

    if (!entry) {
      assert(!this.waitingForRequest.has(e.requestID));
      assert(!this.waitingForResult.has(e.requestID));
      this.waitingForRequest.add(e.requestID);

      this.push({
        requestID: e.requestID,
        request: undefined,
        result: {
          address: e.address,
          blockNumber: e.blockNumber,
          txHash: e.txHash,
          success: e.success,
          result: e.result,
        },
      });

      return true;
    }

    if (!entry.result) {
      assert(!this.waitingForRequest.has(e.requestID));
      assert(this.waitingForResult.has(e.requestID));
      this.waitingForResult.delete(e.requestID);

      entry.result = {
        address: e.address,
        blockNumber: e.blockNumber,
        txHash: e.txHash,
        success: e.success,
        result: e.result,
      };

      return true;
    }

    if (!this.equalResult(e, entry)) {
      throw new HardhatFhevmInternalError(`request id ${e.requestID} result already stored with a different value.`);
    }

    return false;
  }

  public equalRequest(e: FhevmGatewayDecryptionEvent, entry: RequestIDEntry): boolean {
    return (
      e.address === entry.request?.address &&
      e.blockNumber === entry.request.blockNumber &&
      e.maxTimestamp === entry.request.maxTimestamp &&
      e.txHash === entry.request.txHash &&
      e.callbackSelector === entry.request.callbackSelector &&
      e.maxTimestamp === entry.request.maxTimestamp &&
      e.contractCaller === entry.request.contractCaller &&
      e.msgValue === entry.request.msgValue &&
      e.passSignaturesToCaller === entry.request.passSignaturesToCaller &&
      e.handles.length === entry.request.handles.length
    );
  }

  public equalResult(e: FhevmGatewayResultCallbackEvent, entry: RequestIDEntry): boolean {
    return (
      e.address === entry.result?.address &&
      e.blockNumber === entry.result.blockNumber &&
      e.success === entry.result.success &&
      e.txHash === entry.result.txHash &&
      e.result === entry.result?.result
    );
  }

  public getWaitingForResult(): bigint[] {
    return [...this.waitingForResult.keys()];
  }

  public getWaitingForRequest(): bigint[] {
    return [...this.waitingForRequest.keys()];
  }

  public countPending(decryptionRequests?: { requestID: bigint }[]): number {
    if (!decryptionRequests) {
      return this.waitingForResult.size;
    }
    let n = 0;
    for (let i = 0; i < decryptionRequests.length; ++i) {
      if (this.isRequestIDDecrypted(decryptionRequests[i].requestID)) {
        n++;
      }
    }
    return decryptionRequests.length - n;
  }

  public getPendingRequest(requestID: bigint): FhevmGatewayDecryptionEvent {
    assert(!this.waitingForRequest.has(requestID));
    assert(this.waitingForResult.has(requestID));
    const entry = this.ids.get(requestID);
    assert(entry);
    assert(entry.request);
    return {
      ...entry.request,
      requestID,
    };
  }

  public getPendingRequestIDs(requestIDs?: bigint[]): bigint[] {
    let rIDs: bigint[] = [];
    if (requestIDs !== undefined) {
      for (let i = 0; i < requestIDs.length; ++i) {
        const rID = requestIDs[i];
        if (this.waitingForResult.has(rID)) {
          rIDs.push(rID);
        }
      }
    } else {
      rIDs = this.getWaitingForResult();
    }
    return rIDs;
  }

  public isPending(requestID: bigint): boolean {
    if (this.waitingForResult.has(requestID)) {
      assert(!this.waitingForRequest.has(requestID));
      return true;
    }
    return false;
  }

  public filterPendingRequestIDs(events?: { requestID: bigint }[]): bigint[] {
    const res: bigint[] = [];
    if (events === undefined) {
      // All pending requests
      this.waitingForResult.forEach((rID: bigint) => {
        res.push(rID);
      });
    } else {
      for (let i = 0; i < events.length; ++i) {
        const rID = events[i].requestID;
        if (this.isPending(rID)) {
          res.push(rID);
        }
      }
    }

    return res;
  }

  public getHardhatFhevmDecryptions(requestIDs: bigint[]): FhevmGatewayDecryption[] {
    const decryptions: FhevmGatewayDecryption[] = [];
    for (let i = 0; i < requestIDs.length; ++i) {
      const rID = requestIDs[i];
      if (this.waitingForResult.has(rID)) {
        continue;
      }
      const entry = this.ids.get(rID);
      assert(entry);
      assert(entry.result);
      assert(entry.request);
      const d: FhevmGatewayDecryption = {
        requestID: entry.requestID,
        request: { ...entry.request, handles: [...entry.request.handles] },
        result: { ...entry.result },
      };
      decryptions.push(d);
    }
    return decryptions;
  }

  public findWithGreaterOrEqualBlockNumber(blockNum: number) {
    const list: bigint[] = [];
    this.ids.forEach((entry) => {
      if (entry.request && entry.request.blockNumber >= blockNum) {
        list.push(entry.requestID);
      } else if (entry.result && entry.result.blockNumber >= blockNum) {
        list.push(entry.requestID);
      }
    });
    return list;
  }

  public clearGreaterOrEqualToBlock(blockNum: number) {
    const to_remove: bigint[] = this.findWithGreaterOrEqualBlockNumber(blockNum);

    if (to_remove.length === 0) {
      return;
    }

    to_remove.forEach((rID) => {
      if (this.waitingForRequest.has(rID)) {
        this.waitingForRequest.delete(rID);
      }
      if (this.waitingForResult.has(rID)) {
        this.waitingForResult.delete(rID);
      }
      const req = this.ids.get(rID)!;
      if (req.request) {
        const handles = req.request.handles;
        handles.forEach((h) => {
          // remove requestID form handle set
          const handle_to_request_ids = this.handles.get(h);
          assert(handle_to_request_ids);
          const index = handle_to_request_ids.indexOf(rID);
          assert(index >= 0);
          handle_to_request_ids.splice(index, 1);
        });
      }
      this.ids.delete(rID);
    });

    this.update();
  }
}
