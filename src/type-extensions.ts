import "hardhat/types/config";
import "hardhat/types/runtime";
import type {
  HardhatFhevmRuntimeEnvironment,
  HardhatFhevmNodeConfig,
  HardhatFhevmNodeUserConfig,
  HardhatFhevmMockType,
  HardhatFhevmType,
} from "./types";

declare module "hardhat/types/config" {
  export interface ProjectPathsUserConfig {
    /**
     * hardhat-fhevm plugin cache, default = `<hardhat-config.config.paths.root>/hh-fhevm/cache`
     */
    hhFhevmCache?: string;
    /**
     * hardhat-fhevm plugin solidity custom contracts, default = `<hardhat-config.config.paths.root>/hh-fhevm/contracts`
     */
    hhFhevmSources?: string;
    /**
     * Cache used by the local-fhevm node to store keys and docker files, default = `<hardhat-config.config.paths.root>/hh-fhevm/local-fhevm-node`
     */
    localFhevmNodeCache?: string;
  }

  export interface ProjectPathsConfig {
    hhFhevmCache: string;
    hhFhevmSources: string;
    localFhevmNodeCache: string;
  }

  export interface HardhatConfig {
    fhevmNode: HardhatFhevmNodeConfig;
  }

  export interface HardhatUserConfig {
    fhevmNode?: HardhatFhevmNodeUserConfig;
  }

  export interface HardhatNetworkUserConfig {
    fhevm?: HardhatFhevmMockType;
  }

  export interface HardhatNetworkConfig {
    fhevm: HardhatFhevmMockType;
  }

  export interface HttpNetworkUserConfig {
    fhevm?: HardhatFhevmMockType;
  }

  export interface HttpNetworkConfig {
    fhevm: HardhatFhevmType;
  }
}

declare module "hardhat/types/runtime" {
  export interface HardhatRuntimeEnvironment {
    fhevm: HardhatFhevmRuntimeEnvironment;
  }
}
