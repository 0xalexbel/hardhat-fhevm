import { ZAMA_DEV_ACCOUNTS } from "../constants";
import { FhevmContractsConfig, FhevmContractsOverrides } from "./types";

export const TFHEExecutorDBContractInfo = {
  contractName: "TFHEExecutorDB",
  fqn: "fhevm/lib/TFHEExecutorDB.sol:TFHEExecutorDB",
  path: "fhevm/lib/TFHEExecutorDB.sol",
};

// list of all customized solidity files
export const ZamaDevOverrides: FhevmContractsOverrides = [
  { path: "fhevm/lib/TFHEExecutor.sol", legacy: true },
  { path: TFHEExecutorDBContractInfo.path, legacy: false },
];

// list of all remappings
export const ZamaDevRemappings: Array<string> = ["fhevm/lib", "fhevm/gateway"];

/**
 * List of all .sol files to compile :
 *
 * - all the `ZamaDev.contracts` entries marqued as released (`AllReleasedZamaContractNames`)
 * - all the extra contracts listed in `ZamaDevExtraContractsToCompile`
 */
export const ZamaDevExtraContractsToCompile: Array<string> = ["fhevm/gateway/GatewayCaller.sol:GatewayCaller"];

export const ZamaDev: FhevmContractsConfig = {
  deployer: {
    mnemonic: ZAMA_DEV_ACCOUNTS.mnemonic,
    path: ZAMA_DEV_ACCOUNTS.path,
    accounts: {
      fhevm: {
        accountIndex: 9,
        startNonce: 0,
        nextNonce: 4,
      },
      gateway: {
        accountIndex: 4,
        startNonce: 0,
        nextNonce: 1,
      },
    },
  },
  libName: "fhevm",
  solidityVersion: "0.8.24",
  contracts: {
    ACL: {
      //0.5.8: 0
      //0.5.9: 1
      deployer: "fhevm",
      nonce: 0,
      addressFullyQualifiedName: "fhevm/lib/ACLAddress.sol:aclAdd",
      fullyQualifiedName: "fhevm/lib/ACL.sol:ACL",
      envVar: {
        name: "ACL_CONTRACT_ADDRESS",
        dotenvPath: "fhevm/lib/.env.acl",
      },
      // 0.5.8: "0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92"
      // 0.5.9: "0x05fD9B5EFE0a996095f42Ed7e77c390810CF660c"
      fhevmAddress: "0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92",
      deployedOnZamaDev: true,
    },
    TFHEExecutor: {
      //0.5.8: 1
      //0.5.9: 3
      deployer: "fhevm",
      nonce: 1,
      // 0.5.8: fhevmCoprocessorAdd
      // 0.5.9: tfheExecutorAdd
      addressFullyQualifiedName: "fhevm/lib/FHEVMCoprocessorAddress.sol:fhevmCoprocessorAdd",
      fullyQualifiedName: `fhevm/lib/TFHEExecutor.sol:TFHEExecutor`,
      envVar: {
        name: "TFHE_EXECUTOR_CONTRACT_ADDRESS",
        dotenvPath: "fhevm/lib/.env.exec",
      },
      // 0.5.8: "0x05fD9B5EFE0a996095f42Ed7e77c390810CF660c"
      // 0.5.9: "0xcCAe95fF1d11656358E782570dF0418F59fA40e1"
      fhevmAddress: "0x05fD9B5EFE0a996095f42Ed7e77c390810CF660c",
      deployedOnZamaDev: true,
    },
    KMSVerifier: {
      //0.5.8: 2
      //0.5.9: 5
      deployer: "fhevm",
      nonce: 2,
      // 0.5.8: KMS_VERIFIER_CONTRACT_ADDRESS
      // 0.5.9: kmsVerifierAdd
      addressFullyQualifiedName: "fhevm/lib/KMSVerifierAddress.sol:KMS_VERIFIER_CONTRACT_ADDRESS",
      fullyQualifiedName: `fhevm/lib/KMSVerifier.sol:KMSVerifier`,
      envVar: {
        name: "KMS_VERIFIER_CONTRACT_ADDRESS",
        dotenvPath: "fhevm/lib/.env.kmsverifier",
      },
      // 0.5.8: "0x12B064FB845C1cc05e9493856a1D637a73e944bE"
      // 0.5.9: "0x857Ca72A957920Fa0FB138602995839866Bd4005"
      fhevmAddress: "0x12B064FB845C1cc05e9493856a1D637a73e944bE",
      deployedOnZamaDev: true,
    },
    MockedPrecompile: {
      deployer: "fhevm",
      nonce: 3,
      mock: true,
      addressFullyQualifiedName: "fhevm/lib/InputVerifierAddress.sol:inputVerifierAdd",
      fullyQualifiedName: `fhevm/lib/MockedPrecompile.sol:MockedPrecompile`,
      envVar: {
        name: "INPUT_VERIFIER_CONTRACT_ADDRESS",
        dotenvPath: "fhevm/lib/.env.inputVerifier",
      },
      fhevmAddress: "0xcCAe95fF1d11656358E782570dF0418F59fA40e1",
      deployedOnZamaDev: false,
    },
    // FHEPayment: {
    //   deployer: "fhevm",
    //   nonce: 7,
    //   addressFullyQualifiedName: "fhevm/lib/FHEPaymentAddress.sol:fhePaymentAdd",
    //   fullyQualifiedName: `fhevm/lib/FHEPayment.sol:FHEPayment`,
    //   envVar: {
    //     name: "FHE_PAYMENT_CONTRACT_ADDRESS",
    //     dotenvPath: "fhevm/lib/.env.fhepayment",
    //   },
    //   fhevmAddress: "0x52054F36036811ca418be59e41Fc6DD1b9e4F4c8",
    //   deployedOnZamaDev: false,
    // },
    GatewayContract: {
      //0.5.8: 0
      //0.5.9: 2
      deployer: "gateway",
      nonce: 0,
      owner: "gateway",
      //0.5.8: PredeployAddress.sol
      //0.5.9: GatewayContractAddress.sol
      addressFullyQualifiedName: "fhevm/gateway/lib/PredeployAddress.sol:GATEWAY_CONTRACT_PREDEPLOY_ADDRESS",
      fullyQualifiedName: `fhevm/gateway/GatewayContract.sol:GatewayContract`,
      envVar: {
        name: "GATEWAY_CONTRACT_PREDEPLOY_ADDRESS",
        dotenvPath: "fhevm/gateway/.env.gateway",
      },
      // 0.5.8 : "0xc8c9303Cd7F337fab769686B593B87DC3403E0ce"
      // 0.5.9 : "0x096b4679d45fB675d4e2c1E4565009Cec99A12B1"
      fhevmAddress: "0xc8c9303Cd7F337fab769686B593B87DC3403E0ce",
      deployedOnZamaDev: true,
    },
  },
};

//curl https://devnet.zama.ai -X POST -H "Content-Type: application/json" --data '{"method":"eth_getCode","params":["0xc8c9303Cd7F337fab769686B593B87DC3403E0ce","latest"],"id":1,"jsonrpc":"2.0"}'
//curl https://devnet.zama.ai -X POST -H "Content-Type: application/json" --data '{"method":"eth_getCode","params":["0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92","latest"],"id":1,"jsonrpc":"2.0"}'
