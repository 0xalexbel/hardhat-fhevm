// We load the plugin here.
import { HardhatUserConfig } from "hardhat/types";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-ignore-warnings";
import "@typechain/hardhat";

import "./src/index";
import "./src/type-extensions";
import { LOCAL_FHEVM_CHAIN_ID, ZAMA_DEV_NETWORK_CONFIG } from "./src/index";
import { ZAMA_DEV_ACCOUNTS } from "./src/constants";

const config: HardhatUserConfig = {
  //defaultNetwork: ZAMA_DEV_NETWORK_NAME,
  fhevmNode: {
    wsPort: 8546,
    httpPort: 9545,
    gatewayRelayerPrivateKey: "7ec931411ad75a7c201469a385d6f18a325d4923f9f213bd882bbea87e160b67",
  },
  defaultNetwork: "mynode",
  paths: {
    fhevm: "my_funky_fhevm",
  },
  networks: {
    hardhat: {
      mockFhevm: true,
      accounts: {
        initialIndex: 0,
        count: 10,
        mnemonic: ZAMA_DEV_ACCOUNTS.mnemonic,
        path: "m/44'/60'/0'/0",
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
    mynode: {
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
