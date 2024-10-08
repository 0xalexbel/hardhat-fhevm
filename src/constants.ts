import { HardhatNetworkHDAccountsConfig, HttpNetworkConfig, HttpNetworkHDAccountsConfig } from "hardhat/types";

export const FhevmTypeMock = "zama-mock";
export const FhevmTypeHHFhevm = "hh-fhevm";
export const FhevmTypeRemote = "remote";
export const FhevmTypeNative = "native";

/**
 * By default, do not use the EXT_TFHE_LIB address.
 */
export const DEFAULT_USE_EXT_TFHE_LIB = false;

export const LOCAL_FHEVM_NETWORK_NAME: string = "fhevm";

export const ZAMA_DEV_NETWORK_NAME: string = "zama";
export const ZAMA_DEV_GATEWAY_URL: string = "https://gateway.devnet.zama.ai/";

export const DEV_NODE_CHAINID: number = 31337;

export const DEFAULT_GATEWAY_RELAYER_PRIVATE_KEY: string =
  "7ec931411ad75a7c201469a385d6f18a325d4923f9f213bd882bbea87e160b67";
export const DEFAULT_LOCAL_FHEVM_HTTP_PORT: number = 9545;
export const DEFAULT_LOCAL_FHEVM_WS_PORT: number = 8546;
export const DEFAULT_LOCAL_FHEVM_URL: string = `http://localhost:${DEFAULT_LOCAL_FHEVM_HTTP_PORT}`;

export const DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG: HardhatNetworkHDAccountsConfig = {
  accountsBalance: "10000000000000000000000",
  mnemonic: "test test test test test test test test test test test junk",
  initialIndex: 0,
  count: 10,
  path: "m/44'/60'/0'/0",
  passphrase: "",
};

export const ZAMA_DEV_ACCOUNTS: HttpNetworkHDAccountsConfig = {
  mnemonic: "adapt mosquito move limb mobile illegal tree voyage juice mosquito burger raise father hope layer",
  initialIndex: 0,
  count: 10,
  path: "m/44'/60'/0'/0",
  passphrase: "",
};

export const ZAMA_DEV_NETWORK_USER_CONFIG = {
  url: "https://devnet.zama.ai",
  chainId: 9000,
  accounts: ZAMA_DEV_ACCOUNTS,
  gas: "auto" as "auto" | number,
  gasPrice: "auto" as "auto" | number,
  gasMultiplier: 1,
  timeout: 40000,
  httpHeaders: {},
};

export const ZAMA_DEV_NETWORK_CONFIG: HttpNetworkConfig = {
  ...ZAMA_DEV_NETWORK_USER_CONFIG,
  fhevm: FhevmTypeNative,
};

export const EXT_TFHE_LIBRARY = "0x000000000000000000000000000000000000005d";

// in hardhat-config.config.paths
export const DEFAULT_CONFIG_PATHS = {
  hhFhevmCache: "hh-fhevm/cache",
  hhFhevmSources: "hh-fhevm/contracts",
  localFhevmNodeCache: "hh-fhevm/local-fhevm-node",
  solidityOverrides: "solidity/hh-fhevm",
  forge: "forge",
};

export const KEYS_DIRNAME = "keys";
export const PUB_KEYS_DIRNAME = "network-fhe-keys";
export const PRIV_KEYS_DIRNAME = "kms-fhe-keys";
export const PUB_KEY_FILENAME = "pks";
export const PRIV_KEY_FILENAME = "cks";
export const SERVER_KEY_FILENAME = "sks";
