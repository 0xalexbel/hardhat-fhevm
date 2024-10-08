import assert from "assert";
import { HardhatFhevmError } from "../../../error";
import { TFHEExecutorDBContractInfo } from "../../fhevm-config";
import { FhevmEnvironment } from "../../FhevmEnvironment";
import { ethers as EthersT } from "ethers";

type EntryDB256 = {
  valueType: number;
  value: bigint;
  divisionByZero: boolean;
  overflow: boolean;
  underflow: boolean;
  trivial: boolean;
};

export class TFHEExecutorDB {
  private readonly fhevmEnv: FhevmEnvironment;
  private readonly provider: EthersT.Provider;

  private _executorDBAvailable: boolean | undefined;
  private _executorDB: EthersT.Contract | undefined;

  constructor(fhevmEnv: FhevmEnvironment) {
    this.fhevmEnv = fhevmEnv;
    const provider = fhevmEnv.provider;
    if (!provider) {
      throw new HardhatFhevmError("Missing provider");
    }
    this.provider = provider;
  }

  private async getExecutorDB(): Promise<EthersT.Contract> {
    if (!(await this.isAvailable())) {
      throw new HardhatFhevmError("Network does not support on-chain decryption");
    }
    assert(this._executorDB);
    return this._executorDB;
  }

  public async isAvailable(): Promise<boolean> {
    if (this._executorDBAvailable === undefined) {
      try {
        assert(!this._executorDB);
        this._executorDB = await this._getExecutorDBContrat();
        // Dummy call to check if using a mock db
        /*const dbSaveCount =*/ await this._executorDB.db256Count();
        this._executorDBAvailable = true;
      } catch {
        this._executorDBAvailable = false;
      }
    }
    return this._executorDBAvailable;
  }

  private async _getExecutorDBContrat() {
    const executor = await this.fhevmEnv.repository.getContract("TFHEExecutor", this.provider, this.fhevmEnv);
    const executorDBAddr = await executor.db();

    const artifact = await this.fhevmEnv.artifacts.readArtifact(TFHEExecutorDBContractInfo.fqn);
    const factory = await this.fhevmEnv.ethers.getContractFactoryFromArtifact(artifact);
    const executorDB = factory.attach(executorDBAddr).connect(this.provider);

    return executorDB as EthersT.Contract;
  }

  public async db256Count(): Promise<bigint> {
    const db = await this.getExecutorDB();
    const c = await db.db256Count();
    return c;
  }

  public async getDB256Entry(handle: bigint): Promise<EntryDB256> {
    const db = await this.getExecutorDB();
    const e = await db.db_256(handle);
    assert(Array.isArray(e));
    assert(e.length === 6);
    assert(typeof e[0] === "bigint");
    assert(typeof e[1] === "bigint");
    assert(typeof e[2] === "boolean");
    assert(typeof e[3] === "boolean");
    assert(typeof e[4] === "boolean");
    assert(typeof e[5] === "boolean");
    const entry: {
      valueType: number;
      value: bigint;
      divisionByZero: boolean;
      overflow: boolean;
      underflow: boolean;
      trivial: boolean;
    } = { valueType: Number(e[0]), value: e[1], divisionByZero: e[2], overflow: e[3], underflow: e[4], trivial: e[5] };

    return entry;
  }

  public async getDB256(handle: bigint): Promise<bigint> {
    const e = await this.getDB256Entry(handle);
    return e.value;
  }
}
