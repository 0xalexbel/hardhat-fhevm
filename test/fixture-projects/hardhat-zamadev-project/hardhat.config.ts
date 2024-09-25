// We load the plugin here.
import { HardhatUserConfig } from "hardhat/types";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-ignore-warnings";
import "@typechain/hardhat";
// Required: equivalent to 'import "hardhat-fhevm"'
import "../../../src/index";
import {
  DEFAULT_GATEWAY_RELAYER_PRIVATE_KEY,
  DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG,
  ZAMA_DEV_ACCOUNTS,
  ZAMA_DEV_NETWORK_CONFIG,
} from "../../../src/constants";
import { LOCAL_FHEVM_CHAIN_ID } from "../../../src/index";

const config: HardhatUserConfig = {
  //defaultNetwork: ZAMA_DEV_NETWORK_NAME,
  fhevmNode: {
    wsPort: 8546,
    httpPort: 9545,
    gatewayRelayerPrivateKey: DEFAULT_GATEWAY_RELAYER_PRIVATE_KEY,
    accounts: DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG,
  },
  defaultNetwork: "node",
  paths: {
    fhevm: "my_funky_fhevm",
  },
  networks: {
    hardhat: {
      mockFhevm: true,
      accounts: {
        initialIndex: ZAMA_DEV_ACCOUNTS.initialIndex,
        count: ZAMA_DEV_ACCOUNTS.count,
        mnemonic: ZAMA_DEV_ACCOUNTS.mnemonic,
        path: ZAMA_DEV_ACCOUNTS.path,
        passphrase: ZAMA_DEV_ACCOUNTS.passphrase,
      },
    },
    //anvil --port 8645 --chain-id 123456
    anvil: {
      url: "http://localhost:8645",
      chainId: 123456,
      mockFhevm: true,
      accounts: {
        count: 10,
        mnemonic: "test test test test test test test test test test test junk",
        path: "m/44'/60'/0'/0",
      },
    },
    node: {
      url: "http://localhost:8545",
      chainId: 31337,
      mockFhevm: true,
      accounts: {
        count: 10,
        mnemonic: "test test test test test test test test test test test junk",
        path: "m/44'/60'/0'/0",
      },
    },
    fhevm: {
      url: "http://localhost:9545",
      chainId: LOCAL_FHEVM_CHAIN_ID,
    },
    zamadev: ZAMA_DEV_NETWORK_CONFIG,
  },
  solidity: {
    version: "0.8.24",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
    },
  },
  mocha: {
    timeout: 500000,
  },
  // mocha: {
  //   // disable test output of the fixture so that
  //   // the output of the fixture isn't mixed with
  //   // the output of the hardhat tests
  //   reporter: undefined,
  // },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
  warnings: {
    "*": {
      "transient-storage": false,
    },
  },
};

export default config;
