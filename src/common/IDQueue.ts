import assert from "assert";

export class RequestIDQueue<T extends { blockNumber: number; requestID: bigint }> {
  public ids: Map<bigint, T>;
  public min_id: bigint | undefined;
  public max_id: bigint | undefined;
  public min_block: number | undefined;
  public max_block: number | undefined;

  constructor() {
    this.ids = new Map<bigint, T>();
  }

  public push(v: T) {
    const id = v.requestID;
    assert(id >= 0);

    if (this.max_id === undefined) {
      this.min_id = id;
      this.max_id = id;
    } else if (this.max_id > id) {
      assert(false, `push: id=${id}, max_id=${this.max_id}, got a past id???`);
    } else if (this.max_id === id) {
      assert(false, `push: (id=${id}) === (max_id=${this.max_id}), cannot stay still!`);
    } else if (id > this.max_id + BigInt(1)) {
      assert(false, `push: id=${id}, max_id=${this.max_id}, missing #${id - this.max_id - BigInt(1)} ids!`);
    } else {
      assert(id === this.max_id + BigInt(1));
      this.max_id = id;
      assert(this.min_id !== undefined);
      assert(this.min_id < this.max_id);
    }

    if (this.max_block === undefined) {
      this.max_block = v.blockNumber;
      this.min_block = v.blockNumber;
    } else if (this.max_block > v.blockNumber) {
      assert(false, `push: block=${v.blockNumber}, max_block=${this.max_block}, got a past block???`);
    } else if (this.max_block === v.blockNumber) {
      assert(false, `push: (block=${v.blockNumber}) === (max_block=${this.max_block}), cannot go backwards!`);
    } else {
      assert(this.max_block < v.blockNumber);
      this.max_block = v.blockNumber;
      assert(this.min_block !== undefined);
      assert(this.min_block < this.max_block);
    }

    if (!this.ids.has(id)) {
      this.ids.set(id, v);
    } else {
      assert(false, `id=${id} already stored in queue`);
    }
    assert(BigInt(this.ids.size) === this.max_id - this.min_id + BigInt(1));
  }

  private _assert_integrity() {
    if (this.max_id === undefined) {
      assert(this.min_id === undefined);
      assert(this.ids.size === 0);
    } else {
      assert(this.min_id !== undefined);
      const n = this.max_id - this.min_id + BigInt(1);
      assert(n > 0);
      assert(n === BigInt(this.ids.size));
    }
  }

  public length() {
    this._assert_integrity();

    if (this.max_id === undefined) {
      return BigInt(0);
    } else {
      return this.max_id - this.min_id! + BigInt(1);
    }
  }

  public has(t: T) {
    return this.ids.has(t.requestID);
  }

  public clear() {
    this.max_block = undefined;
    this.min_block = undefined;
    this.max_id = undefined;
    this.min_id = undefined;
    const keys = [...this.ids.keys()];
    this.ids.clear();
    return keys;
  }

  public clearRequestIDs(keys: bigint[]) {
    return this._clearKeys(keys, () => true);
  }

  public clearGreaterOrEqualToBlock(blockNum: number): bigint[] {
    if (this.max_block === undefined || blockNum > this.max_block) {
      return [];
    }

    if (blockNum <= 0) {
      return this.clear();
    }

    return this._clearKeys([...this.ids.keys()], (v: T) => v.blockNumber >= blockNum);
  }

  private _update() {
    let max_id: bigint | undefined = undefined;
    let min_id: bigint | undefined = undefined;
    let max_block: number | undefined = undefined;
    let min_block: number | undefined = undefined;

    this.ids.forEach((v: T) => {
      // update max_id
      if (max_id === undefined || v.requestID > max_id) {
        max_id = v.requestID;
      }

      // update min_id
      if (min_id === undefined || v.requestID < min_id) {
        min_id = v.requestID;
      }

      assert(min_id <= max_id);

      // update max_block
      if (max_block === undefined || v.blockNumber > max_block) {
        max_block = v.blockNumber;
      }

      // update min_block
      if (min_block === undefined || v.blockNumber < min_block) {
        min_block = v.blockNumber;
      }

      assert(min_block <= max_block);
    });

    this.max_block = max_block;
    this.min_block = min_block;
    this.max_id = max_id;
    this.min_id = min_id;

    this._assert_integrity();
  }

  private _clearKeys(keys: bigint[], predicate: (value: T) => boolean) {
    if (keys.length === 0) {
      return [];
    }

    const removed_keys = [];

    for (let i = 0; i < keys.length; ++i) {
      const key = keys[i];

      const id = this.ids.get(key);
      if (!id) {
        continue;
      }

      if (predicate(id)) {
        this.ids.delete(key);
        removed_keys.push(key);
      }
    }

    if (removed_keys.length > 0) {
      this._update();
    }

    return removed_keys;
  }
}
