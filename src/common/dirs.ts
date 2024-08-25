import fs from "fs";
import path from "path";
import { HardhatFhevmError } from "./error";
import os from "os";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export function getTmpDir() {
  return path.join(os.tmpdir(), "hardhat-fhevm");
}

export function getPackageDir() {
  const root = path.parse(process.cwd()).root;
  let p = __dirname;

  /* eslint-disable no-constant-condition */
  while (true) {
    if (fs.existsSync(path.join(p, "package.json"))) {
      break;
    }
    p = path.dirname(p);
    if (p === root) {
      throw new HardhatFhevmError("Unable to resolve hardhat-fhevm package directory");
    }
  }

  return p;
}

export function getInstallKeysDir(hre: HardhatRuntimeEnvironment) {
  return path.join(hre.config.paths.fhevm, "keys");
}

export function getInstallPubKeysDir(hre: HardhatRuntimeEnvironment) {
  return path.join(hre.config.paths.fhevm, "keys/network-fhe-keys");
}

export function getInstallPrivKeysDir(hre: HardhatRuntimeEnvironment) {
  return path.join(hre.config.paths.fhevm, "keys/kms-fhe-keys");
}

export function getInstallPrivKeyFile(hre: HardhatRuntimeEnvironment) {
  return path.join(getInstallPrivKeysDir(hre), "cks");
}

export function getInstallPubKeyFile(hre: HardhatRuntimeEnvironment) {
  return path.join(getInstallPubKeysDir(hre), "pks");
}

export function getInstallServerKeyFile(hre: HardhatRuntimeEnvironment) {
  return path.join(getInstallPubKeysDir(hre), "sks");
}

export function keysInstallNeeded(hre: HardhatRuntimeEnvironment): boolean {
  const pks = getInstallPubKeyFile(hre);
  if (!fs.existsSync(pks)) {
    return true;
  }
  const cks = getInstallPrivKeyFile(hre);
  if (!fs.existsSync(cks)) {
    return true;
  }
  const sks = getInstallServerKeyFile(hre);
  if (!fs.existsSync(sks)) {
    return true;
  }
  return false;
}
