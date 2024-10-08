import assert from "assert";
import fs from "fs";
import path from "path";
import { HardhatFhevmError } from "../../error";
import os from "os";
import {
  DEFAULT_CONFIG_PATHS,
  KEYS_DIRNAME,
  PRIV_KEY_FILENAME,
  PRIV_KEYS_DIRNAME,
  PUB_KEY_FILENAME,
  PUB_KEYS_DIRNAME,
  SERVER_KEY_FILENAME,
} from "../../constants";
import { FhevmContractsConfig } from "../types";

export function getTmpDir() {
  return path.join(os.tmpdir(), "hardhat-fhevm");
}

export function getHHFhevmPackageDir() {
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

export function getHHFhevmPackageSolidityOverridesDir() {
  return path.join(getHHFhevmPackageDir(), DEFAULT_CONFIG_PATHS.solidityOverrides);
}

export function getHHFhevmPackageForgeDir() {
  return path.join(getHHFhevmPackageDir(), DEFAULT_CONFIG_PATHS.forge);
}

export function throwIfFileDoesNotExist(path: string) {
  if (!fs.existsSync(path)) {
    throw new HardhatFhevmError(`File '${path}' does not exist`);
  }
  if (!fs.statSync(path).isFile()) {
    throw new HardhatFhevmError(`'${path}' is not a file`);
  }
}

export function throwIfDirDoesNotExist(path: string) {
  if (!fs.existsSync(path)) {
    throw new HardhatFhevmError(`Directory '${path}' does not exist`);
  }
  if (!fs.statSync(path).isDirectory()) {
    throw new HardhatFhevmError(`'${path}' is not a directory`);
  }
}

// = /path/to/root/keys
// = <hardhat.config.paths.fhevmCache>/keys
export function getInstallKeysDir(root: string) {
  return path.join(root, KEYS_DIRNAME);
}

// = /path/to/root/keys/network-fhe-keys
// = <hardhat.config.paths.fhevmCache>/keys/network-fhe-keys
export function getInstallPubKeysDir(root: string) {
  return path.join(getInstallKeysDir(root), PUB_KEYS_DIRNAME);
}

// = /path/to/root/keys/kms-fhe-keys
// = <hardhat.config.paths.fhevmCache>/keys/kms-fhe-keys
export function getInstallPrivKeysDir(root: string) {
  return path.join(getInstallKeysDir(root), PRIV_KEYS_DIRNAME);
}

// = /path/to/root/keys/kms-fhe-keys/cks
// = <hardhat.config.paths.fhevmCache>/keys/cks
export function getInstallPrivKeyFile(root: string) {
  return path.join(getInstallPrivKeysDir(root), PRIV_KEY_FILENAME);
}

// = /path/to/root/keys/kms-fhe-keys/pks
// = <hardhat.config.paths.fhevmCache>/keys/pks
export function getInstallPubKeyFile(root: string) {
  return path.join(getInstallPubKeysDir(root), PUB_KEY_FILENAME);
}

// = /path/to/root/keys/kms-fhe-keys/sks
// = <hardhat.config.paths.fhevmCache>/keys/sks
export function getInstallServerKeyFile(root: string) {
  return path.join(getInstallPubKeysDir(root), SERVER_KEY_FILENAME);
}

export function keysInstallNeeded(root: string): boolean {
  const pks = getInstallPubKeyFile(root);
  if (!fs.existsSync(pks)) {
    return true;
  }
  const cks = getInstallPrivKeyFile(root);
  if (!fs.existsSync(cks)) {
    return true;
  }
  const sks = getInstallServerKeyFile(root);
  if (!fs.existsSync(sks)) {
    return true;
  }
  return false;
}

export function getPrecompileDir(root: string) {
  return path.join(root, "contracts/precompile");
}

export function getImportsDir(root: string) {
  return path.join(root, "contracts/imports");
}

/**
 * If `pathToLib` = `/path/to/my/lib/fhevm` or `/path/to/my/lib`
 *
 * and
 *
 * If `/path/to/my/lib/<path to ACL.sol>` exists
 *
 * Then returns `/path/to/my/lib`
 */
export function getLibDirname(pathToLib: string, config: FhevmContractsConfig, check: boolean) {
  const libName = config.libName;

  let libDirname = pathToLib;
  // pathToLib == /path/to/my/lib/<libName>
  if (path.basename(pathToLib) === libName) {
    libDirname = path.dirname(pathToLib);
  }
  // libDirname == /path/to/my/lib
  libDirname = path.resolve(libDirname);

  if (check) {
    const ACLRelPath = config.contracts.ACL.fullyQualifiedName.split(":").at(0);
    assert(ACLRelPath);
    const ACLPath = path.join(libDirname, ACLRelPath);

    // Quick check, see if ACL.sol exists.
    if (!fs.existsSync(ACLPath)) {
      throw new HardhatFhevmError(
        `${libDirname} directory is not a valid fhevm source repository. Searched for ACL.sol at '${ACLPath}' failed.`,
      );
    }
  }

  return libDirname;
}
