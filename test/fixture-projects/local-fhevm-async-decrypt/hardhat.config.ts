// We load the plugin here.
import { HardhatUserConfig } from "hardhat/types";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-ignore-warnings";
import "@typechain/hardhat";
// Required: equivalent to 'import "hardhat-fhevm"'
import "../../../src/index";
import { LOCAL_FHEVM_CHAIN_ID } from "../../../src/index";

const config: HardhatUserConfig = {
  defaultNetwork: "myfhevm",
  fhevmNode: {
    wsPort: 8546,
    httpPort: 9545,
    gatewayRelayerPrivateKey: "7ec931411ad75a7c201469a385d6f18a325d4923f9f213bd882bbea87e160b67",
    accounts: {
      count: 10,
      mnemonic: "test test test test test test test test test test test junk",
      path: "m/44'/60'/0'/0",
      accountsBalance: "10000000000000000000000",
    },
  },
  paths: {
    fhevm: "my_funky_fhevm",
  },
  networks: {
    myfhevm: {
      url: "http://localhost:9545",
      chainId: LOCAL_FHEVM_CHAIN_ID,
      accounts: {
        count: 10,
        mnemonic: "test test test test test test test test test test test junk",
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
