import { Database } from "sqlite3";

export class HandleDB {
  private db: Database;

  constructor() {
    this.db = new Database(":memory:");
  }

  public async init() {
    const thisDB = this.db;
    return new Promise<void>((resolve, reject) => {
      thisDB.serialize(() =>
        thisDB.run("CREATE TABLE IF NOT EXISTS ciphertexts (handle BINARY PRIMARY KEY,clearText TEXT)", (err) => {
          if (err) {
            reject(new Error(`Error creating database: ${err.message}`));
          } else {
            resolve();
          }
        }),
      );
    });
  }

  public insert(handleHex: string, clearText: bigint, replace: boolean = false) {
    if (handleHex.length !== 66) {
      throw new Error(`Invalid handleHex=${handleHex}`);
    }
    //console.log(`SQL INSERT handle=${handleHex} clearText=${clearText} replace=${replace}`);
    if (replace) {
      // this is useful if using snapshots while sampling different random numbers on each revert
      this.db.run("INSERT OR REPLACE INTO ciphertexts (handle, clearText) VALUES (?, ?)", [
        handleHex,
        clearText.toString(),
      ]);
    } else {
      this.db.run("INSERT OR IGNORE INTO ciphertexts (handle, clearText) VALUES (?, ?)", [
        handleHex,
        clearText.toString(),
      ]);
    }
  }

  public async queryClearTextFromBigInt(handle: bigint): Promise<bigint> {
    const handleHex = "0x" + handle.toString(16).padStart(64, "0");
    //console.log("query handle=" + handleHex);
    return await this.queryClearText(handleHex);
  }

  // Decrypt any handle, bypassing ACL
  // WARNING : only for testing or internal use
  public async queryClearText(handleHex: string): Promise<bigint> {
    const thisDB = this.db;

    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxRetries = 10;

      const _execute_query = () => {
        thisDB.get<{ clearText: string }>(
          "SELECT clearText FROM ciphertexts WHERE handle = ?",
          [handleHex],
          (err, row) => {
            if (err) {
              reject(new Error(`Error querying database: ${err.message}`));
            } else if (row) {
              resolve(BigInt(row.clearText));
            } else if (attempts < maxRetries) {
              attempts++;
              _execute_query();
            } else {
              reject(new Error("No record found after maximum retries"));
            }
          },
        );
      };

      _execute_query();
    });
  }
}
