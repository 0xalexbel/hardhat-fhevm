import { NomicLabsHardhatPluginError } from "hardhat/plugins";

export class HardhatFhevmError extends NomicLabsHardhatPluginError {
  constructor(message: string, parent?: Error) {
    super("hardhat-fhevm", message, parent);
  }
}

export class HardhatFhevmInternalError extends NomicLabsHardhatPluginError {
  constructor(message: string, parent?: Error) {
    super("hardhat-fhevm-internal", message, parent);
  }
}
