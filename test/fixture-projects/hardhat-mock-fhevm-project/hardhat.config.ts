// We load the plugin here.
import { HardhatUserConfig } from "hardhat/types";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-ignore-warnings";
import "@typechain/hardhat";

import "../../../src/index";
import { HARDHAT_FHEVM_DEFAULT_MNEMONIC } from "../../../src/constants";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  paths: {
    fhevm: "my_funky_fhevm",
  },
  networks: {
    hardhat: {
      mockFhevm: true,
      accounts: {
        count: 10,
        mnemonic: HARDHAT_FHEVM_DEFAULT_MNEMONIC,
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
