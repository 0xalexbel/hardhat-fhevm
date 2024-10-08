import { ethers as EthersT } from "ethers";
import assert from "assert";
import { FhevmEnvironment } from "./FhevmEnvironment";
import { FhevmProviderType } from "./FhevmProviderType";
import { FhevmGatewayDecryption, ProviderRpcMethods } from "./types";
import { HardhatFhevmError } from "../error";
import fhevmjs from "fhevmjs/node";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { EthereumProvider } from "hardhat/types";
import { FhevmGatewayAsyncDecryptionsProcessor } from "./gateway/FhevmGatewayResultCallbackProcessor";
import { FhevmjsZKInput } from "../types";
import { bigIntToAddress } from "./utils/address";

////////////////////////////////////////////////////////////////////////////////

export type FhevmjsKeyPair = ReturnType<fhevmjs.FhevmInstance["generateKeypair"]>;
export type FhevmjsEIP712 = ReturnType<fhevmjs.FhevmInstance["createEIP712"]>;
export type FhevmjsReencrypt = ReturnType<fhevmjs.FhevmInstance["reencrypt"]>;
export type FhevmjsGetPublicKey = ReturnType<fhevmjs.FhevmInstance["getPublicKey"]>;

////////////////////////////////////////////////////////////////////////////////

const debug_throwErrorIfGatewayDecryptionFailed: boolean = false;

////////////////////////////////////////////////////////////////////////////////

export abstract class FhevmProvider {
  private _fhevmEnv: FhevmEnvironment;
  private _providerType: FhevmProviderType;
  private _rpcMethods: ProviderRpcMethods | undefined;
  private _initialized: boolean;
  private _fhevmjs_instance: fhevmjs.FhevmInstance | undefined;
  private _keyPair: FhevmjsKeyPair | undefined;

  // ACL and GatewayContract are not necessarily available at init time.
  // This is typically the case at contract deployment time. The provider must be
  // available to perform setBalance operations prior to any contract deploy.
  private _acl: EthersT.Contract | undefined;
  private _gateway: EthersT.Contract | undefined;

  constructor(providerType: FhevmProviderType, rpcMethods: ProviderRpcMethods | undefined, fhevmEnv: FhevmEnvironment) {
    this._fhevmEnv = fhevmEnv;
    this._providerType = providerType;
    this._rpcMethods = rpcMethods;
    this._initialized = false;
  }

  protected async init(): Promise<void> {
    assert(!this._initialized);
    this._initialized = true;
  }

  /**
   * Must be a lazy object.
   * ACL is not always available at init time.
   * This is typically the case at contract deployment time. The provider must be
   * available to perform setBalance operations prior to any contract deployment.
   */
  protected async getACL(): Promise<EthersT.Contract> {
    if (!this._acl) {
      this._acl = await this._fhevmEnv.repository.getContract("ACL", this._fhevmEnv.providerOrThrow, this._fhevmEnv);
    }
    return this._acl;
  }

  /**
   * Must be a lazy object.
   * GatewayContract is not always available at init time.
   * This is typically the case at contract deployment time. The provider must be
   * available to perform setBalance operations prior to any contract deployment.
   */
  protected async getGatewayContract(): Promise<EthersT.Contract> {
    if (!this._gateway) {
      this._gateway = await this._fhevmEnv.repository.getContract(
        "GatewayContract",
        this._fhevmEnv.providerOrThrow,
        this._fhevmEnv,
      );
    }
    return this._gateway;
  }

  /**
   *
   * Abstract methods
   *
   */

  /**
   * Balance abstract methods
   */
  public abstract canSetBalance(): Promise<boolean>;
  public abstract batchSetBalance(addresses: Array<string>, amount: string): Promise<void>;

  /**
   * Gateway async decryptions abstract methods
   */
  public abstract get supportsGatewayDecryption(): boolean;
  public abstract get supportsGatewayAsyncDecryption(): boolean;
  public abstract getGatewayAsyncDecryptionsProcessor(): Promise<FhevmGatewayAsyncDecryptionsProcessor>;

  /**
   * Instance abstract methods
   */
  public abstract createInstance(): Promise<fhevmjs.FhevmInstance>;
  protected abstract createInstanceInternal(): Promise<fhevmjs.FhevmInstance>;

  public abstract coreDecryptBool(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<boolean>;
  protected abstract coreDecrypt4(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint>;
  protected abstract coreDecrypt8(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint>;
  protected abstract coreDecrypt16(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint>;
  protected abstract coreDecrypt32(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint>;
  protected abstract coreDecrypt64(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint>;
  protected abstract coreDecryptAddress(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<string>;

  /**
   * Decrypt abstract methods
   */

  public async createEncryptedInput(
    contractAddress: EthersT.AddressLike,
    userAddress: string,
  ): Promise<FhevmjsZKInput> {
    contractAddress = await EthersT.resolveAddress(contractAddress);
    userAddress = await EthersT.resolveAddress(userAddress);

    const instance = await this.getInstance();
    return instance.createEncryptedInput(contractAddress, userAddress) as FhevmjsZKInput;
  }

  /**
   *
   * Public decrypt API
   *
   */

  public async decryptBool(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<boolean> {
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    const res = await this.coreDecryptBool(handle, contract, signer);
    return res;
  }

  public async decrypt4(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    const res = await this.coreDecrypt4(handle, contract, signer);
    return res;
  }

  public async decrypt8(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    const res = await this.coreDecrypt8(handle, contract, signer);
    return res;
  }

  public async decrypt16(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    const res = await this.coreDecrypt16(handle, contract, signer);
    return res;
  }

  public async decrypt32(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    const res = await this.coreDecrypt32(handle, contract, signer);
    return res;
  }

  public async decrypt64(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<bigint> {
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    const res = await this.coreDecrypt64(handle, contract, signer);
    return res;
  }

  public async decryptAddress(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<string> {
    await this.throwIfCanNotDecrypt(handle, contract, signer);
    const res = await this.coreDecryptAddress(handle, contract, signer);
    return res;
  }

  /**
   *
   * Methods & Properties
   *
   */

  public get initialized() {
    return this._initialized;
  }

  public get fhevmEnv() {
    return this._fhevmEnv;
  }

  public get providerType() {
    return this._providerType;
  }

  public get rpcMethods() {
    return this._rpcMethods;
  }

  public get provider() {
    const p = this._fhevmEnv.provider;
    if (p === undefined) {
      throw new HardhatFhevmError(`Undefined provider`);
    }
    return p;
  }

  protected async getInstance() {
    if (!this._fhevmjs_instance) {
      this._fhevmjs_instance = await this.createInstanceInternal();
    }
    return this._fhevmjs_instance;
  }

  public async throwIfCanNotDecrypt(handle: bigint, contract: EthersT.AddressLike, user: EthersT.AddressLike) {
    const res = await this._canDecrypt(handle, contract, user);
    if (!res.contractIsAllowed) {
      throw new HardhatFhevmError(
        `contract ${await EthersT.resolveAddress(contract)} does not have permission to decrypt handle ${handle}`,
      );
    }
    if (!res.userIsAllowed) {
      throw new HardhatFhevmError(
        `user ${await EthersT.resolveAddress(user)} does not have permission to decrypt handle ${handle}`,
      );
    }
  }

  public async _canDecrypt(
    handle: EthersT.BigNumberish,
    contractAddress: EthersT.AddressLike,
    userAddress: EthersT.AddressLike,
  ): Promise<{ contractIsAllowed: boolean; userIsAllowed: boolean }> {
    const acl = await this.getACL();
    const [contractIsAllowed, userIsAllowed] = await Promise.all([
      acl.persistAllowed(handle, contractAddress),
      acl.persistAllowed(handle, userAddress),
    ]);

    return { contractIsAllowed, userIsAllowed };
  }

  public async canDecrypt(
    handle: EthersT.BigNumberish,
    contractAddress: EthersT.AddressLike,
    userAddress: EthersT.AddressLike,
  ): Promise<boolean> {
    const res = await this._canDecrypt(handle, contractAddress, userAddress);
    return res.contractIsAllowed && res.userIsAllowed;
  }

  public async isAllowed(handle: EthersT.BigNumberish, userAddress: EthersT.AddressLike): Promise<boolean> {
    const acl = await this.getACL();
    const res = await acl.persistAllowed(handle, userAddress);
    assert(typeof res === "boolean");
    return res;
  }

  public async isAllowedForDecryption(handle: EthersT.BigNumberish): Promise<boolean> {
    const acl = await this.getACL();
    const res = await acl.allowedForDecryption(handle);
    assert(typeof res === "boolean");
    return res;
  }

  public async batchIsAllowedForDecryption(handles: EthersT.BigNumberish[]): Promise<boolean[]> {
    const res = await Promise.all(handles.map((handle) => this.isAllowedForDecryption(handle)));
    return res;
  }

  public async waitForAllGatewayAsyncDecryptions(): Promise<FhevmGatewayDecryption[]> {
    if (!this.supportsGatewayAsyncDecryption) {
      throw new HardhatFhevmError(`Provider does not support gateway async decryptions`);
    }
    const gateway = await this.getGatewayAsyncDecryptionsProcessor();
    const res = await gateway.waitForAllAsyncDecryptions();
    return res;
  }

  public async waitForTransactionDecryptions(tx: EthersT.ContractTransactionResponse): Promise<{
    receipt: EthersT.ContractTransactionReceipt;
    results: FhevmGatewayDecryption[];
  } | null> {
    const receipt = await tx.wait();
    if (!receipt) {
      return null;
    }
    const gateway = await this.getGatewayAsyncDecryptionsProcessor();
    /* receipt.hash === decryptionRequests[i].txHash */
    const decryptionRequests = await gateway.parseEventDecryptionEvents(receipt.logs);
    const results = await gateway.waitForAsyncDecryptions(decryptionRequests);
    return { receipt, results };
  }

  /**
   * Helper: Wait a given number of blocks. This is accomplished by either using
   * the built-in evm mining commands or sending empty transaction (when the node is not)
   * in auto-mining mode or simply waiting for the blocks to be mined.
   */
  public async waitNBlocks(nBlocks: number) {
    if (nBlocks <= 0) {
      return;
    }

    // Local functions: force new block by sending a blank transaction
    async function _sendZeroTx(blockCount: number, signer: HardhatEthersSigner, fhevmEvm: FhevmEnvironment) {
      while (blockCount > 0) {
        blockCount--;
        fhevmEvm.logDim(`Wait one block, send empty tx`);
        const receipt = await signer.sendTransaction({
          to: EthersT.ZeroAddress,
          value: 0n,
        });
        await receipt.wait();
      }
    }

    // Local functions: force new block calling hardhat_mine or anvil_mine
    async function _callMine(
      blockCount: number,
      ethProvider: EthereumProvider,
      method: string,
      fhevmEvm: FhevmEnvironment,
    ) {
      while (blockCount > 0) {
        blockCount--;
        fhevmEvm.logDim(`Wait one block, call ${method}`);
        // mine only one block does not work when network == built-in hardhat network
        await ethProvider.send(method, ["0x1"]);
      }
    }

    const pt = this._providerType;
    const mine = this._rpcMethods?.mine;
    const fhevmEnv = this._fhevmEnv;

    const provider: EthersT.Provider = this._fhevmEnv.providerOrThrow;
    const eth_provider: EthereumProvider = this._fhevmEnv.ethProviderOrThrow;

    // Mine directly if the chain supports this feature (hardhat, anvil)
    if (mine) {
      // use built-in mine request
      await _callMine(nBlocks, eth_provider, mine, fhevmEnv);
      return;
    }

    // Mine by sending empty tx
    // Zama chain does not support empty tx mining
    let zeroTxSigner: HardhatEthersSigner | undefined;
    if (pt !== FhevmProviderType.Unknown && pt !== FhevmProviderType.Zama && pt !== FhevmProviderType.Local) {
      const signers = await this._fhevmEnv.ethers.getSigners();
      zeroTxSigner = signers[0];
      assert(zeroTxSigner);
    }

    let blockCount = 0;
    return new Promise((resolve, reject) => {
      const onBlock = async (newBlockNumber: number) => {
        blockCount++;
        if (blockCount >= nBlocks) {
          await provider.off("block", onBlock);
          resolve(newBlockNumber);
        }
      };

      provider.on("block", onBlock).catch((err) => {
        reject(err);
      });

      if (zeroTxSigner) {
        _sendZeroTx(nBlocks, zeroTxSigner, fhevmEnv);
      }
    });
  }

  protected async getKeyPair(): Promise<FhevmjsKeyPair> {
    if (this._keyPair === undefined) {
      const instance = await this.getInstance();
      this._keyPair = instance.generateKeypair();
    }
    return this._keyPair;
  }

  protected async gatewayDecryptHandle(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    if (handle === 0n) {
      return 0n;
    }

    const instance = await this.getInstance();
    const keypair = await this.getKeyPair();

    const contractAddress = await EthersT.resolveAddress(contract);
    const signerAddress = await EthersT.resolveAddress(signer);

    const eip712 = instance.createEIP712(keypair.publicKey, contractAddress);
    const signature = await signer.signTypedData(eip712.domain, { Reencrypt: eip712.types.Reencrypt }, eip712.message);

    const clear = await instance.reencrypt(
      handle,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace("0x", ""),
      contractAddress,
      signerAddress,
    );
    return clear;
  }

  protected async tryGatewayDecrypt(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<{ clear: bigint; succeeded: boolean; error: Error | undefined }> {
    try {
      // Gateway decryption fails sometimes
      const clear = await this.gatewayDecryptHandle(handle, contract, signer);
      return { clear, succeeded: true, error: undefined };
    } catch (e) {
      let error: Error;
      if (e instanceof Error) {
        error = e;
      } else {
        error = new Error("Gateway decryption failed.");
      }
      if (debug_throwErrorIfGatewayDecryptionFailed) {
        throw error;
      }
      return { clear: 0n, succeeded: false, error };
    }
  }

  protected async throwIfNumGatewayDecryptDiffers(
    expectedClearNum: bigint,
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
    debugDecryptionMode: string,
  ) {
    if (!this.supportsGatewayDecryption) {
      return;
    }

    const gatewayResult = await this.tryGatewayDecrypt(handle, contract, signer);

    if (gatewayResult.succeeded) {
      if (gatewayResult.clear !== expectedClearNum) {
        throw new HardhatFhevmError(`Gateway decryption differs from ${debugDecryptionMode} decryption.`);
      } else {
        this.fhevmEnv.logDim(`Gateway decryption succeeded. ${debugDecryptionMode} decryption : ${expectedClearNum}`);
      }
    } else {
      this.fhevmEnv.logDim(`Gateway decryption failed. ${debugDecryptionMode} decryption : ${expectedClearNum}`);
    }
  }

  protected async throwIfStringGatewayDecryptDiffers(
    expectedClearString: string,
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
    debugDecryptionMode: string,
  ) {
    if (!this.supportsGatewayDecryption) {
      return;
    }

    const gatewayResult = await this.tryGatewayDecrypt(handle, contract, signer);

    if (gatewayResult.succeeded) {
      const gatewayResultClearString = bigIntToAddress(gatewayResult.clear);
      if (gatewayResultClearString !== expectedClearString) {
        throw new HardhatFhevmError(
          `Gateway decryption (${gatewayResultClearString}) differs from ${debugDecryptionMode} decryption (${expectedClearString}).`,
        );
      } else {
        this.fhevmEnv.logDim(
          `Gateway decryption succeeded. ${debugDecryptionMode} decryption : ${expectedClearString}`,
        );
      }
    } else {
      this.fhevmEnv.logDim(`Gateway decryption failed. ${debugDecryptionMode} decryption : ${expectedClearString}`);
    }
  }

  protected async throwIfBoolGatewayDecryptDiffers(
    expectedClearBool: boolean,
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
    debugDecryptionMode: string,
  ) {
    if (!this.supportsGatewayDecryption) {
      return;
    }

    const gatewayResult = await this.tryGatewayDecrypt(handle, contract, signer);

    if (gatewayResult.succeeded) {
      const gatewayResultClearBool = gatewayResult.clear !== 0n;
      if (gatewayResultClearBool !== expectedClearBool) {
        throw new HardhatFhevmError(
          `Gateway decryption (${gatewayResultClearBool}) differs from ${debugDecryptionMode} decryption (${expectedClearBool}).`,
        );
      } else {
        this.fhevmEnv.logDim(`Gateway decryption succeeded. ${debugDecryptionMode} decryption : ${expectedClearBool}`);
      }
    } else {
      this.fhevmEnv.logDim(`Gateway decryption failed. ${debugDecryptionMode} decryption : ${expectedClearBool}`);
    }
  }
}

////////////////////////////////////////////////////////////////////////////////

export class UnknownFhevmProvider extends FhevmProvider {
  constructor(providerType: FhevmProviderType, fhevmEnv: FhevmEnvironment) {
    assert(providerType === FhevmProviderType.Unknown);
    super(providerType, undefined, fhevmEnv);
  }

  public override async canSetBalance(): Promise<boolean> {
    return false;
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public override async batchSetBalance(addresses: Array<string>, amount: string): Promise<void> {
    throw new HardhatFhevmError("Set balance not supported.");
  }

  public override get supportsGatewayDecryption(): boolean {
    return false;
  }

  public override get supportsGatewayAsyncDecryption(): boolean {
    return false;
  }

  public override getGatewayAsyncDecryptionsProcessor(): Promise<FhevmGatewayAsyncDecryptionsProcessor> {
    throw new HardhatFhevmError("Gateway async decryption not supported.");
  }

  public override createInstance(): Promise<fhevmjs.FhevmInstance> {
    throw new HardhatFhevmError("createInstance is not supported.");
  }
  protected override createInstanceInternal(): Promise<fhevmjs.FhevmInstance> {
    throw new HardhatFhevmError("createInstance is not supported.");
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public override createEncryptedInput(
    contractAddress: EthersT.AddressLike,
    userAddress: string,
  ): Promise<FhevmjsZKInput> {
    throw new HardhatFhevmError(`createEncryptedInput is not supported`);
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public override async coreDecryptBool(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<boolean> {
    throw new HardhatFhevmError(`decryptBool is not supported`);
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public override async coreDecrypt4(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    throw new HardhatFhevmError(`decrypt4 is not supported`);
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public override async coreDecrypt8(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    throw new HardhatFhevmError(`decrypt8 is not supported`);
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public override async coreDecrypt16(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    throw new HardhatFhevmError(`decrypt16 is not supported`);
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public override async coreDecrypt32(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    throw new HardhatFhevmError(`decrypt32 is not supported`);
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public override async coreDecrypt64(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer,
  ): Promise<bigint> {
    throw new HardhatFhevmError(`decrypt64 is not supported`);
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public coreDecryptAddress(handle: bigint, contract: EthersT.AddressLike, signer: EthersT.Signer): Promise<string> {
    throw new HardhatFhevmError(`decryptAddress is not supported`);
  }
}

////////////////////////////////////////////////////////////////////////////////

export class NativeFhevmGatewayResultCallbackProcessor extends FhevmGatewayAsyncDecryptionsProcessor {
  constructor(fhevmProvider: FhevmProvider, gatewayContract: EthersT.Contract) {
    super(fhevmProvider, gatewayContract);
  }

  /**
   * Do nothing in native mode, since we are not able to decrypt the handle instantly
   */
  protected override async tryDecrypt(/*requestIDs: bigint[]*/): Promise<void> {}
}

export abstract class NativeFhevmProvider extends FhevmProvider {
  private _gatewayDecryptionsProcessor: NativeFhevmGatewayResultCallbackProcessor | undefined;

  constructor(providerType: FhevmProviderType, fhevmEnv: FhevmEnvironment) {
    assert(providerType === FhevmProviderType.Local || providerType === FhevmProviderType.Zama);
    super(providerType, undefined, fhevmEnv);
  }

  protected override async init() {
    await super.init();
  }

  /**
   * Gateway async decryptions abstract methods
   */

  public override get supportsGatewayDecryption(): boolean {
    return true;
  }
  public override get supportsGatewayAsyncDecryption(): boolean {
    return true;
  }

  public override async getGatewayAsyncDecryptionsProcessor(): Promise<NativeFhevmGatewayResultCallbackProcessor> {
    if (!this._gatewayDecryptionsProcessor) {
      const gateway = await this.getGatewayContract();
      this._gatewayDecryptionsProcessor = new NativeFhevmGatewayResultCallbackProcessor(this, gateway);
      await this._gatewayDecryptionsProcessor.init();
    }
    return this._gatewayDecryptionsProcessor;
  }

  /**
   * Instance abstract methods
   */

  public override async createInstance(): Promise<fhevmjs.FhevmInstance> {
    return this.createInstanceInternal();
  }

  protected override async createInstanceInternal(): Promise<fhevmjs.FhevmInstance> {
    const fhevmjs_instance = await fhevmjs.createInstance({
      networkUrl: this.networkUrl,
      gatewayUrl: this.gatewayUrl,
    });
    return fhevmjs_instance;
  }

  /**
   * Native provider url abstract methods
   */

  public abstract get networkUrl(): string;
  public abstract get gatewayUrl(): string;
}

////////////////////////////////////////////////////////////////////////////////
