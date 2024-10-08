import path from "path";
import { ConfigExtender, HardhatConfig, HardhatUserConfig } from "hardhat/types";
import { HardhatFhevmNodeConfig } from "../types";
import {
  DEFAULT_CONFIG_PATHS,
  DEFAULT_GATEWAY_RELAYER_PRIVATE_KEY,
  DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG,
  DEFAULT_LOCAL_FHEVM_HTTP_PORT,
  DEFAULT_LOCAL_FHEVM_WS_PORT,
  DEV_NODE_CHAINID,
  FhevmTypeHHFhevm,
  FhevmTypeNative,
  FhevmTypeRemote,
  LOCAL_FHEVM_NETWORK_NAME,
  ZAMA_DEV_ACCOUNTS,
  ZAMA_DEV_NETWORK_CONFIG,
  ZAMA_DEV_NETWORK_NAME,
} from "../constants";
import { LOCAL_FHEVM_CHAIN_ID } from "./DockerServicesConfig";
import { HARDHAT_NETWORK_NAME } from "hardhat/plugins";
import { HardhatFhevmError } from "../error";

/*

 Hardhat ConfigExtender
 Called at Hardhat initialization
 
 Default values:
 ===============
 
 defaultConfig: HardhatUserConfig = {
  networks: {
    hardhat: {
      fhevm: "hh-fhevm",
    },
  }

 */

export const configExtender: ConfigExtender = (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
  const userHHFhevmCache = userConfig.paths?.hhFhevmCache;
  const userHHFhevmSources = userConfig.paths?.hhFhevmSources;
  const userLocalFhevmNodeCache = userConfig.paths?.localFhevmNodeCache;

  const userFhevmNode = userConfig.fhevmNode;

  const fhevmNode: HardhatFhevmNodeConfig = {
    accounts: {
      count: userFhevmNode?.accounts?.count ?? DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.count,
      accountsBalance: userFhevmNode?.accounts?.accountsBalance ?? DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.accountsBalance,
      initialIndex: userFhevmNode?.accounts?.initialIndex ?? DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.initialIndex,
      passphrase: userFhevmNode?.accounts?.passphrase ?? DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.passphrase,
      path: userFhevmNode?.accounts?.path ?? DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.path,
      mnemonic: userFhevmNode?.accounts?.mnemonic ?? DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.mnemonic,
    },
    gatewayRelayerPrivateKey: userFhevmNode?.gatewayRelayerPrivateKey ?? DEFAULT_GATEWAY_RELAYER_PRIVATE_KEY,
    httpPort: userFhevmNode?.httpPort ?? DEFAULT_LOCAL_FHEVM_HTTP_PORT,
    wsPort: userFhevmNode?.wsPort ?? DEFAULT_LOCAL_FHEVM_WS_PORT,
  };
  config.fhevmNode = fhevmNode;

  // Default value is "remote"
  const networks = Object.keys(config.networks);
  for (let i = 0; i < networks.length; ++i) {
    const networkName = networks[i];
    const network = config.networks[networkName];
    if (networkName === LOCAL_FHEVM_NETWORK_NAME) {
      network.fhevm = FhevmTypeNative;
    } else if (networkName === "localhost" && network.chainId === DEV_NODE_CHAINID) {
      network.fhevm = FhevmTypeHHFhevm;
    } else {
      network.fhevm = FhevmTypeRemote;
    }
  }

  if (!userConfig.networks || !("localhost" in userConfig.networks)) {
    // "localhost" default
    config.networks["localhost"].fhevm = FhevmTypeHHFhevm;
  }

  // "zamadev" default
  if (!userConfig.networks || !(ZAMA_DEV_NETWORK_NAME in userConfig.networks)) {
    config.networks[ZAMA_DEV_NETWORK_NAME] = { ...ZAMA_DEV_NETWORK_CONFIG };
    config.networks[ZAMA_DEV_NETWORK_NAME].accounts = { ...ZAMA_DEV_ACCOUNTS };
  }

  if (userConfig.networks && LOCAL_FHEVM_NETWORK_NAME in userConfig.networks) {
    const network = userConfig.networks[LOCAL_FHEVM_NETWORK_NAME];
    if (network) {
      if (network.fhevm !== undefined && (network.fhevm as string) !== FhevmTypeNative) {
        throw new HardhatFhevmError(
          `The '${LOCAL_FHEVM_NETWORK_NAME}' network is reserved and its type must always be set to "${FhevmTypeNative}"`,
        );
      }
      if (network.chainId !== undefined && network.chainId !== LOCAL_FHEVM_CHAIN_ID) {
        throw new HardhatFhevmError(
          `The '${LOCAL_FHEVM_NETWORK_NAME}' network is reserved and its chainId must always be set to '${LOCAL_FHEVM_CHAIN_ID}'`,
        );
      }
    }
  }

  // local "fhevm" default
  if (!userConfig.networks || !(LOCAL_FHEVM_NETWORK_NAME in userConfig.networks)) {
    config.networks[LOCAL_FHEVM_NETWORK_NAME] = {
      url: `http://localhost:${fhevmNode.httpPort}`,
      accounts: DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG,
      chainId: LOCAL_FHEVM_CHAIN_ID,
      fhevm: FhevmTypeNative,
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1,
      timeout: 40000,
      httpHeaders: {},
    };
  }

  // Force "hardhat"
  config.networks[HARDHAT_NETWORK_NAME].fhevm = FhevmTypeHHFhevm;

  // Override with user config
  if (userConfig.networks) {
    const userNetworks = userConfig.networks;
    const userNetworkNames = Object.keys(userNetworks);
    for (let i = 0; i < userNetworkNames.length; ++i) {
      const userNetworkName = userNetworkNames[i];
      const userNetwork = userNetworks[userNetworkName];
      if (userNetwork?.fhevm !== undefined) {
        config.networks[userNetworkName].fhevm = userNetwork.fhevm;
      }
    }
  }

  setup_readonly_path("hhFhevmCache", userHHFhevmCache, DEFAULT_CONFIG_PATHS.hhFhevmCache, config);
  setup_readonly_path("hhFhevmSources", userHHFhevmSources, DEFAULT_CONFIG_PATHS.hhFhevmSources, config);
  setup_readonly_path("localFhevmNodeCache", userLocalFhevmNodeCache, DEFAULT_CONFIG_PATHS.localFhevmNodeCache, config);
};

function setup_readonly_path(
  varname: string,
  userPath: string | undefined,
  defaultPath: string,
  config: HardhatConfig,
) {
  let p;
  if (userPath === undefined) {
    p = path.join(config.paths.root, defaultPath);
  } else {
    if (path.isAbsolute(userPath)) {
      p = userPath;
    } else {
      p = path.join(config.paths.root, userPath);
    }
  }

  p = path.normalize(p);

  Object.defineProperty(config.paths, varname, {
    get: () => p,
    set: () => {
      throw new HardhatFhevmError(`The hardhat-fhevm config property '${varname}' cannot be modified at runtime.`);
    },
  });
}
