import { HardhatNetworkHDAccountsConfig } from "hardhat/types";

export type FhevmHttpNetworkConfig = {
  chainId?: number;
  from?: string;
  gas: "auto" | number;
  gasPrice: "auto" | number;
  gasMultiplier: number;
  url: string;
  timeout: number;
  httpHeaders: { [name: string]: string };
  accounts: HardhatNetworkHDAccountsConfig & FhevmNetworkAccountsConfig;
};

export type FhevmNetworkAccountsConfig = {
  GatewayKmsKeyID: string;
  GatewayRelayerPrivateKey: string;
  GatewayContractDeployer: number;
  GatewayContractOwner: number;
  fhevmOwner: number;
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
