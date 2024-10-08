import { HardhatFhevmError } from "../error";

export enum FhevmProviderType {
  Unknown = 0,
  Local,
  Zama,
  Anvil,
  Hardhat,
  HardhatNode,
}

export function providerTypeToString(providerType: FhevmProviderType) {
  switch (providerType) {
    case FhevmProviderType.Unknown:
      return "Unknown";
    case FhevmProviderType.Local:
      return "Local fhevm";
    case FhevmProviderType.Zama:
      return "Zama dev fhevm";
    case FhevmProviderType.Anvil:
      return "Anvil mock fhevm";
    case FhevmProviderType.Hardhat:
      return "Hardhat mock fhevm";
    case FhevmProviderType.HardhatNode:
      return "Hardhat node mock fhevm";
    default:
      throw new HardhatFhevmError(`Unsupported provider type ${providerType}`);
  }
}
