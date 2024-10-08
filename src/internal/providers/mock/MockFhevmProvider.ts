import { ethers as EthersT } from "ethers";
import assert from "assert";
import { FhevmEnvironment } from "../../FhevmEnvironment";
import { FhevmProviderType } from "../../FhevmProviderType";
import { ProviderRpcMethods } from "../../types";
import fhevmjs from "fhevmjs/node";
import { HardhatFhevmError } from "../../../error";
import { EthereumProvider } from "hardhat/types";
import { FhevmProvider } from "../../FhevmProvider";
import { TFHEExecutorDB } from "./TFHEExecutorDB";
import { MockFhevmCoProcessor } from "./MockFhevmCoProcessor";
import { MockFhevmGatewayResultCallbackProcessor } from "./MockFhevmGatewayResultCallbackProcessor";
import { createEncryptedInputMocked, reencryptRequestMocked } from "./mock_fhevmjs";
import { bigIntToAddress } from "../../utils/address";
import { FhevmTypeHHFhevm } from "../../../constants";

////////////////////////////////////////////////////////////////////////////////

export class MockFhevmProvider extends FhevmProvider {
  private static __constructorGuard: boolean = true;

  private readonly _onChainDecryptorDB: TFHEExecutorDB | undefined;
  private readonly _mockCoProcessor: MockFhevmCoProcessor | undefined;
  private readonly _chainId: number;

  private _gatewayDecryptionsProcessor: MockFhevmGatewayResultCallbackProcessor | undefined;

  constructor(
    providerType: FhevmProviderType,
    rpcMethods: ProviderRpcMethods,
    chainId: number,
    fhevmEnv: FhevmEnvironment,
  ) {
    if (MockFhevmProvider.__constructorGuard) {
      throw new HardhatFhevmError(`MockFhevmProvider constructor is not accessible, use static create`);
    }
    MockFhevmProvider.__constructorGuard = true;

    assert(
      providerType === FhevmProviderType.Anvil ||
        providerType === FhevmProviderType.Hardhat ||
        providerType === FhevmProviderType.HardhatNode,
    );

    super(providerType, rpcMethods, fhevmEnv);

    if (providerType === FhevmProviderType.Anvil) {
      if (!fhevmEnv.deployOptions.mockOnChainDecrypt) {
        throw new HardhatFhevmError(
          `Anvil only supports on-chain decryption. In your hardhat config file, set 'fhevm: "${FhevmTypeHHFhevm}"' in the anvil network configuration.`,
        );
      }
    }

    if (fhevmEnv.deployOptions.mockOnChainDecrypt) {
      this._onChainDecryptorDB = new TFHEExecutorDB(fhevmEnv);
    } else {
      this._mockCoProcessor = new MockFhevmCoProcessor(fhevmEnv);
    }

    this._chainId = chainId;
  }

  public static async create(
    providerType: FhevmProviderType,
    rpcMethods: ProviderRpcMethods,
    fhevmEnv: FhevmEnvironment,
  ) {
    assert(MockFhevmProvider.__constructorGuard);
    MockFhevmProvider.__constructorGuard = false;

    const chainId = await fhevmEnv.getChainIdOrThrow();

    const p = new MockFhevmProvider(providerType, rpcMethods, chainId, fhevmEnv);
    await p.init();

    return p;
  }

  protected override async init() {
    await super.init();
    if (this._mockCoProcessor) {
      await this._mockCoProcessor.init();
    }
  }

  /**
   * Gateway async decryptions abstract methods
   */

  public override get supportsGatewayDecryption(): boolean {
    return true;
  }

  public override get supportsGatewayAsyncDecryption(): boolean {
    return this.providerType === FhevmProviderType.Hardhat || this.providerType === FhevmProviderType.HardhatNode;
  }

  public override async getGatewayAsyncDecryptionsProcessor(): Promise<MockFhevmGatewayResultCallbackProcessor> {
    if (!this._gatewayDecryptionsProcessor) {
      const gateway = await this.getGatewayContract();
      this._gatewayDecryptionsProcessor = new MockFhevmGatewayResultCallbackProcessor(
        this,
        gateway,
        this.fhevmEnv.gatewayRelayerWallet,
      );
      await this._gatewayDecryptionsProcessor.init();
    }
    return this._gatewayDecryptionsProcessor;
  }

  /**
   * Balance abstract methods
   */

  public override async canSetBalance(): Promise<boolean> {
    return this.rpcMethods?.setBalance !== undefined;
  }

  public override async batchSetBalance(addresses: Array<string>, amount: string) {
    const ethProvider = this.fhevmEnv.ethProvider;
    assert(ethProvider);

    const mth = this.rpcMethods?.setBalance;
    assert(mth);
    await Promise.all(addresses.map((a) => this._setBalance(ethProvider, a, amount, mth)));
  }

  private async _setBalance(ethProvider: EthereumProvider, address: string, amount: string, rpc_method_name: string) {
    const q_amount = EthersT.toQuantity(amount);
    const bn_amount = EthersT.toBigInt(q_amount);

    const b = await ethProvider.send("eth_getBalance", [address, "latest"]);
    const bn_b = EthersT.getBigInt(b);
    if (bn_b >= bn_amount) {
      return;
    }

    await ethProvider.send(rpc_method_name, [address, q_amount]);

    const after_b = await ethProvider.send("eth_getBalance", [address, "latest"]);
    const bn_after_b = EthersT.getBigInt(after_b);
    if (bn_after_b !== bn_amount) {
      throw new HardhatFhevmError(
        `Failed to set account balance (account=${address}, amount=${amount}, balance=${bn_after_b})`,
      );
    }

    this.fhevmEnv.logDim(`${address} balance=${amount}`);
  }

  /**
   * Decryptions abstract methods
   */

  public override async coreDecryptBool(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<boolean> {
    const clearBn = await this.decryptMockHandle(handle, contract, signer);
    const clearBool = clearBn !== 0n;
    await this.throwIfBoolGatewayDecryptDiffers(clearBool, handle, contract, signer, "Mock");
    return clearBool;
  }

  public override async coreDecrypt4(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const clearBn = await this.decryptMockHandle(handle, contract, signer);
    await this.throwIfNumGatewayDecryptDiffers(clearBn, handle, contract, signer, "Mock");
    return clearBn;
  }

  public override async coreDecrypt8(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const clearBn = await this.decryptMockHandle(handle, contract, signer);
    await this.throwIfNumGatewayDecryptDiffers(clearBn, handle, contract, signer, "Mock");
    return clearBn;
  }

  public override async coreDecrypt16(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const clearBn = await this.decryptMockHandle(handle, contract, signer);
    await this.throwIfNumGatewayDecryptDiffers(clearBn, handle, contract, signer, "Mock");
    return clearBn;
  }

  public override async coreDecrypt32(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const clearBn = await this.decryptMockHandle(handle, contract, signer);
    await this.throwIfNumGatewayDecryptDiffers(clearBn, handle, contract, signer, "Mock");
    return clearBn;
  }

  public override async coreDecrypt64(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    const clearBn = await this.decryptMockHandle(handle, contract, signer);
    await this.throwIfNumGatewayDecryptDiffers(clearBn, handle, contract, signer, "Mock");
    return clearBn;
  }

  public override async coreDecryptAddress(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<string> {
    const clearBn = await this.decryptMockHandle(handle, contract, signer);
    const clearAddress = bigIntToAddress(clearBn);
    await this.throwIfStringGatewayDecryptDiffers(clearAddress, handle, contract, signer, "Mock");
    return clearAddress;
  }

  public async batchDecryptMockHandles(handles: bigint[]): Promise<bigint[]> {
    let clearBNs: bigint[];
    if (this._onChainDecryptorDB) {
      const db = this._onChainDecryptorDB;
      // Decrypt using on-chain clear text database
      clearBNs = await Promise.all(handles.map(async (handle) => db.getDB256(handle)));
    } else if (this._mockCoProcessor) {
      await this._mockCoProcessor.wait();
      const coproc = this._mockCoProcessor;
      // Decrypt using off-chain mock coprocessor
      clearBNs = await Promise.all(handles.map(async (handle) => await coproc.queryClearTextFromBigInt(handle)));
    } else {
      throw new HardhatFhevmError("Unable to decrypt handle");
    }
    return clearBNs;
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public async decryptMockHandle(
    handle: bigint,
    contract: EthersT.AddressLike,
    user: EthersT.AddressLike,
  ): Promise<bigint> {
    let clearBN: bigint;
    if (this._onChainDecryptorDB) {
      // Decrypt using on-chain clear text database
      clearBN = await this._onChainDecryptorDB.getDB256(handle);
    } else if (this._mockCoProcessor) {
      // Decrypt using off-chain mock coprocessor
      await this._mockCoProcessor.wait();
      clearBN = BigInt(await this._mockCoProcessor.queryClearTextFromBigInt(handle));
    } else {
      throw new HardhatFhevmError("Unable to decrypt handle");
    }
    return clearBN;
  }

  /**
   * Instance abstract methods
   */

  /**
   * Returns a new fhevmjs.FhevmInstance for public use
   */
  public override async createInstance(): Promise<fhevmjs.FhevmInstance> {
    const mock_fhevmjs_instance = await fhevmjs.createInstance({ chainId: this._chainId });
    mock_fhevmjs_instance.createEncryptedInput = createEncryptedInputMocked;
    mock_fhevmjs_instance.getPublicKey = () => "0xFFAA44433";
    // when creating a new public instance, activate ACL checking
    mock_fhevmjs_instance.reencrypt = reencryptRequestMocked(this, this._chainId, false);
    return mock_fhevmjs_instance;
  }

  /**
   * Returns a new fhevmjs.FhevmInstance for internal use
   */
  protected override async createInstanceInternal(): Promise<fhevmjs.FhevmInstance> {
    const mock_fhevmjs_instance = await fhevmjs.createInstance({ chainId: this._chainId });
    mock_fhevmjs_instance.createEncryptedInput = createEncryptedInputMocked;
    mock_fhevmjs_instance.getPublicKey = () => "0xFFAA44433";
    // when creating a new internal instance, skip ACL checking
    mock_fhevmjs_instance.reencrypt = reencryptRequestMocked(this, this._chainId, true);
    return mock_fhevmjs_instance;
  }
}
