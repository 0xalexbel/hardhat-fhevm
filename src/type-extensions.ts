import "hardhat/types/config";
import "hardhat/types/runtime";
import type { FhevmHttpNetworkConfig } from "./types";

import { HardhatFhevmRuntimeEnvironment } from "./common/HardhatFhevmRuntimeEnvironment";

declare module "hardhat/types/config" {
  export interface ProjectPathsUserConfig {
    fhevm?: string;
  }

  export interface ProjectPathsConfig {
    fhevm: string;
    fhevmContracts: string;
  }

  export interface HardhatNetworkUserConfig {
    mockFhevm?: boolean;
  }

  export interface HardhatNetworkConfig {
    mockFhevm: boolean;
  }

  export interface NetworksConfig {
    fhevm: FhevmHttpNetworkConfig;
  }
}

declare module "hardhat/types/runtime" {
  export interface HardhatRuntimeEnvironment {
    fhevm: HardhatFhevmRuntimeEnvironment;
  }
}
