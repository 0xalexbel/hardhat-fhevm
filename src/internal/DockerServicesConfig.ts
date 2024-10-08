export type DockerServicesConfig = {
  FhevmValidatorHttpPort: number;
  FhevmValidatorWsPort: number;
  TFHEExecutorContractAddress: string;
  GatewayEthereumRelayerKey: string;
  GatewayEthereumOraclePredeployAddress: string;
};

export type DockerComposeJson = {
  name: string;
  services: {
    "fhevm-validator": {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      environment: any;
      image: string;
      ports: string[];
    };
    gateway: {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      environment: any;
      image: string;
      ports: string[];
    };
    "kms-core": {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      environment: any;
      image: string;
      ports: string[];
    };
  };
};

export const ServiceNames: Record<string, keyof DockerComposeJson["services"]> = {
  validator: "fhevm-validator",
  gateway: "gateway",
  kmsCore: "kms-core",
};

export const LOCAL_FHEVM_CHAIN_ID: number = 9000;
