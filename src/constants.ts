import { FhevmHttpNetworkConfig } from "./types";

// hardhatconfig.paths.fhevm
export const DEFAULT_CONFIG_PATH_FHEVM = "hh_fhevm";

export const HARDHAT_FHEVM_DEFAULT_MNEMONIC: string =
  "adapt mosquito move limb mobile illegal tree voyage juice mosquito burger raise father hope layer";

export const LOCAL_FHEVM_NETWORK_NAME: string = "fhevm";

// Cannot be modified (should be the same in docker-compose-full.yml)
export const DEFAULT_GATEWAY_KMS_KEY_ID: string = "408d8cbaa51dece7f782fe04ba0b1c1d017b1088";

export const DEFAULT_GATEWAY_RELAYER_PRIVATE_KEY: string =
  "7ec931411ad75a7c201469a385d6f18a325d4923f9f213bd882bbea87e160b67";

export const DEFAULT_LOCAL_FHEVM_URL: string = "http://localhost:8545";

export const DEFAULT_LOCAL_FHEVM_CHAIN_ID: number = 9000;

export const DEFAULT_LOCAL_FHEVM_ACCOUNT_BALANCE: string = "10000000000000000000000";

export const DEFAULT_FHEVM_NETWORK_CONFIG: FhevmHttpNetworkConfig = {
  chainId: DEFAULT_LOCAL_FHEVM_CHAIN_ID,
  gas: "auto",
  gasPrice: "auto",
  gasMultiplier: 1,
  url: DEFAULT_LOCAL_FHEVM_URL,
  timeout: 20000,
  httpHeaders: {},
  accounts: {
    count: 10,
    mnemonic: HARDHAT_FHEVM_DEFAULT_MNEMONIC,
    path: "m/44'/60'/0'/0",
    initialIndex: 0,
    passphrase: "",
    accountsBalance: DEFAULT_LOCAL_FHEVM_ACCOUNT_BALANCE, //balance after call to "docker faucet"
    fhevmOwner: 9,
    GatewayContractDeployer: 4,
    GatewayContractOwner: 4,
    GatewayRelayerPrivateKey: DEFAULT_GATEWAY_RELAYER_PRIVATE_KEY,
    // Cannot be modified (should be the same in docker-compose-full.yml)
    GatewayKmsKeyID: DEFAULT_GATEWAY_KMS_KEY_ID,
  },
};
