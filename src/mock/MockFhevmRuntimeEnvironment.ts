import { ethers as EthersT } from "ethers";
import assert from "assert";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  HardhatFhevmRuntimeEnvironment,
  HardhatFhevmRuntimeEnvironmentType,
} from "../common/HardhatFhevmRuntimeEnvironment";
import { HardhatFhevmError } from "../error";
import { MockFhevmCoProcessor } from "./MockFhevmCoProcessor";
import { MockFhevmInstance } from "./MockFhevmInstance";
import { bigIntToAddress } from "../utils";
import { MockResultCallbackProcessor } from "./MockResultCallbackProcessor";
import { ResultCallbackProcessor } from "../common/ResultCallbackProcessor";
import { getUserPackageNodeModulesDir, zamaGetContrat } from "../common/zamaContracts";
import { ZamaDev } from "../constants";

export class MockFhevmRuntimeEnvironment extends HardhatFhevmRuntimeEnvironment {
  private _coprocessor: MockFhevmCoProcessor | undefined;
  private _resultprocessor: MockResultCallbackProcessor | undefined;
  private _executor: EthersT.Contract | undefined;
  private _executorHasMockDB: boolean | undefined;

  constructor(hre: HardhatRuntimeEnvironment) {
    super(HardhatFhevmRuntimeEnvironmentType.Mock, hre);
  }

  public static cast(fhevm: HardhatFhevmRuntimeEnvironment): MockFhevmRuntimeEnvironment {
    if (fhevm.runtimeType === HardhatFhevmRuntimeEnvironmentType.Mock) {
      assert(fhevm instanceof MockFhevmRuntimeEnvironment);
      return fhevm;
    }
    throw new HardhatFhevmError(`fhevm is not an instance of MockFhevmRuntimeEnvironment`);
  }

  private async executorHasMockDB() {
    if (this._executorHasMockDB === undefined) {
      try {
        const executor = await this.executor();
        // Dummy call to check if using a mock db
        /*const dbSaveCount =*/ await executor.dbSaveCount();
        this._executorHasMockDB = true;
      } catch (e) {
        this._executorHasMockDB = false;
      }
    }
    return this._executorHasMockDB;
  }

  private async executor() {
    if (!this._executor) {
      const contractsRootDir = getUserPackageNodeModulesDir(this.hre.config);
      const provider = this.hre.ethers.provider;
      this._executor = await zamaGetContrat("TFHEExecutor", contractsRootDir, ZamaDev, provider, this.hre);
    }
    return this._executor;
  }

  protected async resultprocessor(): Promise<ResultCallbackProcessor> {
    if (!this._resultprocessor) {
      this._resultprocessor = new MockResultCallbackProcessor(this.hre);
      await this._resultprocessor.init();
    }
    return this._resultprocessor;
  }

  private async coprocessor(): Promise<MockFhevmCoProcessor> {
    // Could be called multiple times from the outside world
    if (!this._coprocessor) {
      this._coprocessor = new MockFhevmCoProcessor(this.hre);
      // initialize sql3 ONLY
      await this._coprocessor.init();
    }
    return this._coprocessor;
  }

  public async waitForCoprocessing() {
    assert(!this.hre.network.config.useOnChainFhevmMockProcessor);
    const coproc = await this.coprocessor();
    await coproc.wait();
  }

  public async queryClearText(handle: EthersT.BigNumberish): Promise<bigint> {
    assert(!this.hre.network.config.useOnChainFhevmMockProcessor);
    const coproc = await this.coprocessor();
    const bn = await coproc.handleDB().queryClearTextFromBigInt(EthersT.toBigInt(handle));
    return bn;
  }

  public async createInstance(): Promise<MockFhevmInstance> {
    return MockFhevmInstance.create(this.hre);
  }

  public async batchDecryptBigInt(handles: bigint[]): Promise<bigint[]> {
    if ((await this.executorHasMockDB()) && this.hre.network.config.useOnChainFhevmMockProcessor) {
      const executor = await this.executor();
      const savedClearBNs = await Promise.all(handles.map(async (handle) => BigInt(await executor.db(handle))));
      return savedClearBNs;
    } else {
      await this.waitForCoprocessing();
      const clearBNs = await Promise.all(handles.map(async (handle) => BigInt(await this.queryClearText(handle))));
      return clearBNs;
    }
  }

  public async decryptBigInt(
    handle: bigint,
    contract: EthersT.AddressLike,
    user: EthersT.AddressLike,
  ): Promise<bigint> {
    await this.throwIfCanNotDecrypt(handle, contract, user);

    if ((await this.executorHasMockDB()) && this.hre.network.config.useOnChainFhevmMockProcessor) {
      const executor = await this.executor();
      const savedClearBN = await executor.db(handle);
      return savedClearBN;
    } else {
      await this.waitForCoprocessing();
      const clearBN = BigInt(await this.queryClearText(handle));
      return clearBN;
    }
  }

  public async decryptBool(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<boolean> {
    const bn = await this.decryptBigInt(handle, contract, signer);
    return bn === BigInt(1);
  }

  public override async decrypt4(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const bn = await this.decryptBigInt(handle, contract, signer);
    return bn;
  }

  public override async decrypt8(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const bn = await this.decryptBigInt(handle, contract, signer);
    return bn;
  }

  public override async decrypt16(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const bn = await this.decryptBigInt(handle, contract, signer);
    return bn;
  }

  public override async decrypt32(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const bn = await this.decryptBigInt(handle, contract, signer);
    return bn;
  }

  public async decrypt64(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    const bn = await this.decryptBigInt(handle, contract, signer);
    return bn;
  }

  public override async decryptAddress(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<string> {
    const bn = await this.decryptBigInt(handle, contract, signer);
    return bigIntToAddress(bn);
  }

  public async canSetBalance(): Promise<boolean> {
    const pi = await this.getProviderInfos();
    return pi.setBalance !== undefined;
  }

  private async _setBalance(address: string, amount: string, rpc_method_name: string) {
    const q_amount = EthersT.toQuantity(amount);
    const bn_amount = EthersT.toBigInt(q_amount);

    const hre_provider = this.hre.network.provider;

    const b = await hre_provider.send("eth_getBalance", [address, "latest"]);
    const bn_b = EthersT.getBigInt(b);
    if (bn_b >= bn_amount) {
      return;
    }

    await hre_provider.send(rpc_method_name, [address, q_amount]);

    const after_b = await hre_provider.send("eth_getBalance", [address, "latest"]);
    const bn_after_b = EthersT.getBigInt(after_b);
    if (bn_after_b !== bn_amount) {
      throw new HardhatFhevmError(
        `Failed to set account balance (account=${address}, amount=${amount}, balance=${bn_after_b})`,
      );
    }
  }

  public async batchSetBalance(addresses: Array<string>, amount: string) {
    const pi = await this.getProviderInfos();
    const rpc_method_name = pi.setBalance;
    assert(rpc_method_name);
    await Promise.all(addresses.map((a) => this._setBalance(a, amount, rpc_method_name)));
  }
}
