// We load the plugin here.
import { HardhatUserConfig } from "hardhat/types";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-ignore-warnings";
import "@typechain/hardhat";
// Required: equivalent to 'import "hardhat-fhevm"'
import "../../../src/index";
import { ZAMA_DEV_ACCOUNTS } from "../../../src/constants";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  paths: {
    fhevm: "my_funky_fhevm",
  },
  networks: {
    hardhat: {
      // Runs with our without interval continuous mining
      // mining: {
      //   auto: false,
      //   interval: 100,
      // },
      mockFhevm: true,
      accounts: {
        count: 10,
        mnemonic: ZAMA_DEV_ACCOUNTS.mnemonic,
        path: "m/44'/60'/0'/0",
      },
    },
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
