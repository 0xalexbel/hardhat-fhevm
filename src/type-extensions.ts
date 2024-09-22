import "hardhat/types/config";
import "hardhat/types/runtime";
import type { FhevmNodeConfig, FhevmNodeUserConfig } from "./types";
import type { HardhatFhevmRuntimeEnvironment } from "./common/HardhatFhevmRuntimeEnvironment";

declare module "hardhat/types/config" {
  export interface ProjectPathsUserConfig {
    fhevm?: string;
  }

  export interface ProjectPathsConfig {
    fhevm: string;
    fhevmContracts: string;
  }

  export interface HardhatConfig {
    fhevmNode: FhevmNodeConfig;
  }

  export interface HardhatUserConfig {
    fhevmNode?: FhevmNodeUserConfig;
  }

  export interface HardhatNetworkUserConfig {
    mockFhevm?: boolean;
    useOnChainFhevmMockProcessor?: boolean;
  }

  export interface HardhatNetworkConfig {
    mockFhevm: boolean;
    useOnChainFhevmMockProcessor?: boolean;
  }

  export interface HttpNetworkUserConfig {
    mockFhevm?: boolean;
    useOnChainFhevmMockProcessor?: boolean;
  }

  export interface HttpNetworkConfig {
    mockFhevm?: boolean;
    useOnChainFhevmMockProcessor?: boolean;
  }
}

declare module "hardhat/types/runtime" {
  export interface HardhatRuntimeEnvironment {
    fhevm: HardhatFhevmRuntimeEnvironment;
  }
}
