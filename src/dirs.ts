import fs from "fs";
import path from "path";
import { HardhatFhevmError } from "./error";
import os from "os";
import {
  KEYS_DIRNAME,
  PRIV_KEY_FILENAME,
  PRIV_KEYS_DIRNAME,
  PUB_KEY_FILENAME,
  PUB_KEYS_DIRNAME,
  SERVER_KEY_FILENAME,
} from "./constants";

export function getTmpDir() {
  return path.join(os.tmpdir(), "hardhat-fhevm");
}

export function getPackageDir() {
  const root = path.parse(process.cwd()).root;
  let p = __dirname;

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

export function getInstallKeysDir(fhevmPath: string) {
  return path.join(fhevmPath, KEYS_DIRNAME);
}

export function getInstallPubKeysDir(fhevmPath: string) {
  return path.join(getInstallKeysDir(fhevmPath), PUB_KEYS_DIRNAME);
}

export function getInstallPrivKeysDir(fhevmPath: string) {
  return path.join(getInstallKeysDir(fhevmPath), PRIV_KEYS_DIRNAME);
}

export function getInstallPrivKeyFile(fhevmPath: string) {
  return path.join(getInstallPrivKeysDir(fhevmPath), PRIV_KEY_FILENAME);
}

export function getInstallPubKeyFile(fhevmPath: string) {
  return path.join(getInstallPubKeysDir(fhevmPath), PUB_KEY_FILENAME);
}

export function getInstallServerKeyFile(fhevmPath: string) {
  return path.join(getInstallPubKeysDir(fhevmPath), SERVER_KEY_FILENAME);
}

export function keysInstallNeeded(fhevmPath: string): boolean {
  const pks = getInstallPubKeyFile(fhevmPath);
  if (!fs.existsSync(pks)) {
    return true;
  }
  const cks = getInstallPrivKeyFile(fhevmPath);
  if (!fs.existsSync(cks)) {
    return true;
  }
  const sks = getInstallServerKeyFile(fhevmPath);
  if (!fs.existsSync(sks)) {
    return true;
  }
  return false;
}

export function getPrecompileDir(fhevmPath: string) {
  return path.join(fhevmPath, "contracts/precompile");
}

export function getImportsDir(fhevmPath: string) {
  return path.join(fhevmPath, "contracts/imports");
}

export function getOverridesDir(fhevmPath: string) {
  return path.join(fhevmPath, "contracts/overrides");
}
