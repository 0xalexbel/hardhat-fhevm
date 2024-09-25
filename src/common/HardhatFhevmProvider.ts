import { ethers as EthersT } from "ethers";
import { HardhatFhevmInstance } from "./HardhatFhevmInstance";
import { ResultCallbackProcessor } from "./ResultCallbackProcessor";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { HardhatFhevmDecryption } from "../types";
import { FhevmProviderInfos } from "./FhevmProviderInfos";

export abstract class HardhatFhevmProvider {
  protected hre: HardhatRuntimeEnvironment;
  private readonly _fhevmProviderInfos: FhevmProviderInfos;
  constructor(fhevmProvider: FhevmProviderInfos, hre: HardhatRuntimeEnvironment) {
    this.hre = hre;
    this._fhevmProviderInfos = fhevmProvider;
  }

  public get infos() {
    return this._fhevmProviderInfos;
  }

  public abstract isRunning(): Promise<boolean>;
  public abstract resultprocessor(): Promise<ResultCallbackProcessor>;
  public abstract createInstance(): Promise<HardhatFhevmInstance>;
  public abstract decryptBool(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<boolean>;
  public abstract decrypt4(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint>;
  public abstract decrypt8(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint>;
  public abstract decrypt16(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint>;
  public abstract decrypt32(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint>;
  public abstract decrypt64(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint>;
  public abstract decryptAddress(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<string>;

  public abstract canSetBalance(): Promise<boolean>;
  public abstract batchSetBalance(addresses: Array<string>, amount: string): Promise<void>;

  public async waitForAllDecryptions(): Promise<HardhatFhevmDecryption[]> {
    const rp = await this.resultprocessor();
    const decs = await rp.waitForDecryptions();
    return decs;
  }

  public async waitForTransactionDecryptions(tx: EthersT.ContractTransactionResponse): Promise<{
    receipt: EthersT.ContractTransactionReceipt;
    results: HardhatFhevmDecryption[];
  } | null> {
    const receipt = await tx.wait();
    if (!receipt) {
      return null;
    }
    // receipt.hash === decryptionRequests[i].txHash
    const rp = await this.resultprocessor();
    const decryptionRequests = await rp.parseEventDecryptionEvents(receipt.logs);
    const results = await rp.waitForDecryptions(decryptionRequests);
    return { receipt, results };
  }
}
