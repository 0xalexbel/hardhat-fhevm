export enum HardhatFhevmProviderType {
  Unknown = 0,
  Local,
  Zama,
  Anvil,
  Hardhat,
  HardhatNode,
}

export function providerTypeToString(providerType: HardhatFhevmProviderType) {
  switch (providerType) {
    case HardhatFhevmProviderType.Unknown:
      return "Unknown";
    case HardhatFhevmProviderType.Local:
      return "Local fhevm";
    case HardhatFhevmProviderType.Zama:
      return "Zama dev fhevm";
    case HardhatFhevmProviderType.Anvil:
      return "Anvil mock fhevm";
    case HardhatFhevmProviderType.Hardhat:
      return "Hardhat mock fhevm";
    case HardhatFhevmProviderType.HardhatNode:
      return "Hardhat node mock fhevm";
    default:
      break;
  }
}
