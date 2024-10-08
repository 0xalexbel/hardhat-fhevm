import { HardhatNetworkHDAccountsConfig, HardhatNetworkHDAccountsUserConfig } from "hardhat/types";
import type { ethers as EthersT } from "ethers";
import type fhevmjs from "fhevmjs/node";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

export type FhevmjsZKInput = ReturnType<fhevmjs.FhevmInstance["createEncryptedInput"]> & {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  addBytes256(value: Uint8Array): any;
};

export type HardhatFhevmMockType = "zama-mock" | "hh-fhevm" | "remote";
export type HardhatFhevmType = "native" | HardhatFhevmMockType;

export type HardhatFhevmRuntimeLogOptions = {
  quiet?: boolean;
  stderr?: boolean;
};

export interface HardhatFhevmGateway {
  get relayerWallet(): EthersT.Wallet;
  waitForAllAsyncDecryptions(): Promise<void>;
}

export interface HardhatFhevmRuntimeHelpers {
  bigIntToUint8Array(value: bigint): Uint8Array;
  waitNBlocks(count: number): Promise<void>;
}

export type HardhatFhevmRuntimeCapabilities = {
  supportsEBytes256: boolean;
  supportsAsyncDecryption: boolean;
  rpcMethods: {
    evmSnapshot: boolean;
    evmRevert: boolean;
  };
};

export interface HardhatFhevmRuntimeEnvironment {
  get logOptions(): HardhatFhevmRuntimeLogOptions;
  set logOptions(value: HardhatFhevmRuntimeLogOptions);

  get gateway(): HardhatFhevmGateway;
  get helpers(): HardhatFhevmRuntimeHelpers;

  getCapabilities(): Promise<HardhatFhevmRuntimeCapabilities>;

  createInstance(): Promise<fhevmjs.FhevmInstance>;

  createEncryptedInput(contractAddress: EthersT.AddressLike, userAddress: string): Promise<FhevmjsZKInput>;

  decrypt64(
    handle: bigint,
    contract: EthersT.AddressLike,
    signer: EthersT.Signer | HardhatEthersSigner,
  ): Promise<bigint>;
}

export type HardhatFhevmNodeConfig = {
  wsPort: number;
  httpPort: number;
  gatewayRelayerPrivateKey: string;
  accounts: HardhatNetworkHDAccountsConfig;
};

export type HardhatFhevmNodeUserConfig = {
  wsPort?: number;
  httpPort?: number;
  gatewayRelayerPrivateKey?: string;
  accounts?: HardhatNetworkHDAccountsUserConfig;
};

export type HardhatFhevmDecryption = {
  requestID: bigint;
  request: {
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
  result: {
    address: string;
    blockNumber: number;
    txHash: string;
    success: boolean;
    result: string;
  };
};
