import { HardhatNetworkHDAccountsConfig, HardhatNetworkHDAccountsUserConfig } from "hardhat/types";

export type FhevmNodeConfig = {
  wsPort: number;
  httpPort: number;
  gatewayRelayerPrivateKey: string;
  accounts: HardhatNetworkHDAccountsConfig;
};

export type FhevmNodeUserConfig = {
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

export type HardhatFhevmRuntimeLogOptions = {
  quiet?: boolean;
  stderr?: boolean;
};

export type HardhatFhevmProviderInfos = {
  setBalance: string | undefined;
  setCode: string | undefined;
  mine: string | undefined;
};
