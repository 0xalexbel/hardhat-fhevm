import { ethers as EthersT } from "ethers";
import { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";
import { Artifacts } from "hardhat/types";
import { HardhatEthersProvider } from "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider";

export type FhevmUserDeployOptions = {
  noProvider?: boolean;
  provider?: EthersT.Provider;
  mock?: boolean;
  useExtTfheLib?: boolean;
  mockOnChainDecrypt?: boolean;
};

export type FhevmDeployOptions = {
  provider: EthersT.Provider | HardhatEthersProvider | undefined;
  mock: boolean;
  useExtTfheLib: boolean;
  mockOnChainDecrypt: boolean;
};

export type ProviderRpcMethods = {
  setBalance: string | undefined;
  setCode: string | undefined;
  mine: string | undefined;
  evmSnapshot: string | undefined;
  evmRevert: string | undefined;
};

export type ProviderFhevmCapabilities = {
  /**
   * supports async decypt mechanism
   */
  supportsAsyncDecryption: boolean;
  /**
   * supports direct decryption using Private Key
   */
  supportsPkDecryption: boolean;
  /**
   * supports Zama's Gateway reencrypt mechanism
   */
  supportsGatewayDecryption: boolean;
  /**
   * supports on-chain TFHEExecutor decrypt DB
   */
  supportsOnChainDecryption: boolean;
  /**
   * supports Zama's MockFhevmCoProcessor
   */
  supportsMockDecryption: boolean;
  /**
   * supports mock fhevm
   */
  supportsMock: boolean;
};

export interface HardhatFhevmEthers {
  artifacts: Artifacts;
  ethers: HardhatEthersHelpers;
}

export type FhevmContractName =
  | "ACL"
  | "KMSVerifier"
  | "TFHEExecutor"
  | "GatewayContract"
  //  | "FHEPayment"
  | "MockedPrecompile";

export type FhevmContractEnvVar = {
  name: string;
  dotenvPath: string;
};

export type FhevmContractConfig = {
  nonce: number;
  deployer: "fhevm" | "gateway";
  owner?: "fhevm" | "gateway";
  addressFullyQualifiedName: string;
  fullyQualifiedName: string;
  envVar?: FhevmContractEnvVar;
  fhevmAddress: string;
  deployedOnZamaDev: boolean;
  mock?: boolean;
};

export type FhevmContractDeployer = {
  accountIndex: number;
  startNonce: number;
  nextNonce: number;
};

export type FhevmContractsConfig = {
  deployer: {
    mnemonic: string;
    path: string;
    accounts: {
      fhevm: FhevmContractDeployer;
      gateway: FhevmContractDeployer;
    };
  };
  libName: string;
  solidityVersion: string;
  contracts: Record<FhevmContractName, FhevmContractConfig>;
};

export type FhevmContractsOverrides = Array<FhevmContractsOverride>;
export type FhevmContractsOverride = {
  path: string;
  legacy: boolean;
};

export type FhevmContractParams = {
  contractName: FhevmContractName;
  config: FhevmContractConfig;
  contractAddressPath: string;
  contractPath: string;
  dotenvPath?: string;
};

/**
 * `ResultCallback` event
 */
export type FhevmGatewayResultCallbackEvent = {
  address: string;
  blockNumber: number;
  txHash: string;
  requestID: bigint;
  success: boolean;
  result: EthersT.BytesLike;
};

/**
 * `EventDecryption` event
 */
export type FhevmGatewayDecryptionEvent = {
  address: string;
  blockNumber: number;
  txHash: string;
  requestID: bigint;
  handles: EthersT.BigNumberish[]; //cts
  contractCaller: EthersT.AddressLike;
  callbackSelector: EthersT.BytesLike;
  msgValue: EthersT.BigNumberish;
  maxTimestamp: EthersT.BigNumberish;
  passSignaturesToCaller: boolean;
};

export type FhevmGatewayDecryption = {
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
