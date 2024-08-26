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

export type LogOptions = {
  indent: string;
};

export function logBox(msg: string) {
  const left = " ".repeat(1);
  const inner = " ".repeat(2);

  const prefix = "hardhat-fhevm:";
  const n = msg.length + inner.length * 2 + prefix.length + 1;
  msg = `\x1b[32m${prefix}\x1b[0m ${msg}`;

  const top = left + "╔" + "═".repeat(n) + "╗\n";
  const middle = left + "║" + inner + msg + inner + "║\n";
  const bottom = left + "╚" + "═".repeat(n) + "╝";

  const box = top + middle + bottom;

  console.log("");
  console.log(box);
  console.log("");
}

export function logTrace(msg: string, options?: LogOptions) {
  const indent = options ? options.indent : "";
  console.log(`${indent}\x1b[32m✔ hardhat-fhevm:\x1b[0m ${msg}`);
}

export function logDim(msg: string, options?: LogOptions) {
  const indent = options ? options.indent : "";
  console.log(`${indent}\x1b[2m${msg}\x1b[0m`);
}
