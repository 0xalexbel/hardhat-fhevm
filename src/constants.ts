import { HardhatNetworkHDAccountsConfig, HttpNetworkConfig, HttpNetworkHDAccountsConfig } from "hardhat/types";

export const ZAMA_DEV_NETWORK_NAME: string = "zamadev";
export const LOCAL_FHEVM_NETWORK_NAME: string = "fhevm";
export const ZAMA_DEV_GATEWAY_URL: string = "https://gateway.devnet.zama.ai/";

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

export const ZAMA_DEV_NETWORK_CONFIG: HttpNetworkConfig = {
  url: "https://devnet.zama.ai",
  chainId: 9000,
  accounts: ZAMA_DEV_ACCOUNTS,
  gas: "auto",
  gasPrice: "auto",
  gasMultiplier: 1,
  timeout: 40000,
  httpHeaders: {},
  mockFhevm: false,
  useOnChainFhevmMockProcessor: false,
};

export const EXT_TFHE_LIBRARY = "0x000000000000000000000000000000000000005d";

// hardhatconfig.paths.fhevm
export const DEFAULT_CONFIG_PATH_FHEVM = "hh_fhevm";

export const KEYS_DIRNAME = "keys";
export const PUB_KEYS_DIRNAME = "network-fhe-keys";
export const PRIV_KEYS_DIRNAME = "kms-fhe-keys";
export const PUB_KEY_FILENAME = "pks";
export const PRIV_KEY_FILENAME = "cks";
export const SERVER_KEY_FILENAME = "sks";

export type ZamaContractName = "ACL" | "KMSVerifier" | "TFHEExecutor" | "GatewayContract" | "FHEPayment";
export const AllZamaContractNames: ZamaContractName[] = [
  "ACL",
  "KMSVerifier",
  "TFHEExecutor",
  "GatewayContract",
  "FHEPayment",
];
export const AllReleasedZamaContractNames: ZamaContractName[] = [
  "ACL",
  "KMSVerifier",
  "TFHEExecutor",
  "GatewayContract",
];

export type ZamaDevContractEnvVar = {
  name: string;
  dotenvDir: string;
  dotenvFilename: string;
};

export type ZamaDevContractConfig = {
  nonce: number;
  deployer: number;
  owner?: number;
  contractFilename: string;
  contractAddressFilename: string;
  contractImportDir: string;
  contractAddressImportDir: string;
  fullyQualifiedName: string;
  solidityVarName: string;
  envVar?: ZamaDevContractEnvVar;
  fhevmAddress: string;
  deployedOnZamaDev: boolean;
};

export type ZamaDevConfig = {
  deployer: {
    mnemonic: string;
    path: string;
    fhevmDeployer: number;
    fhevmDeployerNextNonce: number;
    gatewayDeployer: number;
    gatewayDeployerNextNonce: number;
  };
  contracts: Record<ZamaContractName, ZamaDevContractConfig>;
};

export type ZamaDevContractParams = {
  contractName: ZamaContractName;
  config: ZamaDevContractConfig;
  contractAddressPath: string;
  contractPath: string;
  dotenvPath?: string;
};

export const ZamaDev: ZamaDevConfig = {
  deployer: {
    mnemonic: ZAMA_DEV_ACCOUNTS.mnemonic,
    path: ZAMA_DEV_ACCOUNTS.path,
    fhevmDeployer: 9,
    fhevmDeployerNextNonce: 3,
    gatewayDeployer: 4,
    gatewayDeployerNextNonce: 1,
  },
  contracts: {
    ACL: {
      //0.5.8: 0
      //0.5.9: 1
      nonce: 0,
      deployer: 9,
      contractFilename: "ACL.sol",
      contractAddressFilename: "ACLAddress.sol",
      contractImportDir: "fhevm/lib",
      contractAddressImportDir: "fhevm/lib",
      fullyQualifiedName: `fhevm/lib/ACL.sol:ACL`,
      solidityVarName: "aclAdd",
      envVar: {
        name: "ACL_CONTRACT_ADDRESS",
        dotenvDir: "fhevm/lib",
        dotenvFilename: ".env.acl",
      },
      // 0.5.8: "0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92"
      // 0.5.9: "0x05fD9B5EFE0a996095f42Ed7e77c390810CF660c"
      fhevmAddress: "0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92",
      deployedOnZamaDev: true,
    },
    TFHEExecutor: {
      //0.5.8: 1
      //0.5.9: 3
      nonce: 1,
      deployer: 9,
      contractFilename: "TFHEExecutor.sol",
      contractAddressFilename: "FHEVMCoprocessorAddress.sol",
      contractImportDir: "fhevm/lib",
      contractAddressImportDir: "fhevm/lib",
      fullyQualifiedName: `fhevm/lib/TFHEExecutor.sol:TFHEExecutor`,
      // 0.5.8: fhevmCoprocessorAdd
      // 0.5.9: tfheExecutorAdd
      solidityVarName: "fhevmCoprocessorAdd",
      envVar: {
        name: "TFHE_EXECUTOR_CONTRACT_ADDRESS",
        dotenvDir: "fhevm/lib",
        dotenvFilename: ".env.exec",
      },
      // 0.5.8: "0x05fD9B5EFE0a996095f42Ed7e77c390810CF660c"
      // 0.5.9: "0xcCAe95fF1d11656358E782570dF0418F59fA40e1"
      fhevmAddress: "0x05fD9B5EFE0a996095f42Ed7e77c390810CF660c",
      deployedOnZamaDev: false,
    },
    KMSVerifier: {
      //0.5.8: 2
      //0.5.9: 5
      nonce: 2,
      deployer: 9,
      contractFilename: "KMSVerifier.sol",
      contractAddressFilename: "KMSVerifierAddress.sol",
      contractImportDir: "fhevm/lib",
      contractAddressImportDir: "fhevm/lib",
      // 0.5.8: KMS_VERIFIER_CONTRACT_ADDRESS
      // 0.5.9: kmsVerifierAdd
      solidityVarName: "KMS_VERIFIER_CONTRACT_ADDRESS",
      fullyQualifiedName: `fhevm/lib/KMSVerifier.sol:KMSVerifier`,
      envVar: {
        name: "KMS_VERIFIER_CONTRACT_ADDRESS",
        dotenvDir: "fhevm/lib",
        dotenvFilename: ".env.kmsverifier",
      },
      // 0.5.8: "0x12B064FB845C1cc05e9493856a1D637a73e944bE"
      // 0.5.9: "0x857Ca72A957920Fa0FB138602995839866Bd4005"
      fhevmAddress: "0x12B064FB845C1cc05e9493856a1D637a73e944bE",
      deployedOnZamaDev: false,
    },
    FHEPayment: {
      nonce: 7,
      deployer: 9,
      contractFilename: "FHEPayment.sol",
      contractAddressFilename: "FHEPaymentAddress.sol",
      contractImportDir: "fhevm/lib",
      contractAddressImportDir: "fhevm/lib",
      fullyQualifiedName: `fhevm/lib/FHEPayment.sol:FHEPayment`,
      envVar: {
        name: "FHE_PAYMENT_CONTRACT_ADDRESS",
        dotenvDir: "fhevm/lib",
        dotenvFilename: ".env.fhepayment",
      },
      solidityVarName: "fhePaymentAdd",
      fhevmAddress: "0x52054F36036811ca418be59e41Fc6DD1b9e4F4c8",
      deployedOnZamaDev: false,
    },
    GatewayContract: {
      //0.5.8: 0
      //0.5.9: 2
      nonce: 0,
      deployer: 4,
      owner: 4,
      contractFilename: "GatewayContract.sol",
      //0.5.8: PredeployAddress.sol
      //0.5.9: GatewayContractAddress.sol
      contractAddressFilename: "PredeployAddress.sol",
      contractImportDir: "fhevm/gateway",
      contractAddressImportDir: "fhevm/gateway/lib",
      fullyQualifiedName: `fhevm/gateway/GatewayContract.sol:GatewayContract`,
      envVar: {
        name: "GATEWAY_CONTRACT_PREDEPLOY_ADDRESS",
        dotenvDir: "fhevm/gateway",
        dotenvFilename: ".env.gateway",
      },
      solidityVarName: "GATEWAY_CONTRACT_PREDEPLOY_ADDRESS",
      // 0.5.8 : "0xc8c9303Cd7F337fab769686B593B87DC3403E0ce"
      // 0.5.9 : "0x096b4679d45fB675d4e2c1E4565009Cec99A12B1"
      fhevmAddress: "0xc8c9303Cd7F337fab769686B593B87DC3403E0ce",
      deployedOnZamaDev: true,
    },
  },
};

//curl https://devnet.zama.ai -X POST -H "Content-Type: application/json" --data '{"method":"eth_getCode","params":["0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92","latest"],"id":1,"jsonrpc":"2.0"}'
