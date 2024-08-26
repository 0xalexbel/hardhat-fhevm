import dotenv from "dotenv";
import fs from "fs";
import { Artifact, HardhatConfig, HardhatNetworkHDAccountsConfig, HardhatRuntimeEnvironment } from "hardhat/types";
import path from "path";
import { ethers } from "ethers";
import { HardhatFhevmError, logDim, logTrace } from "./error";
import assert from "assert";
import { replaceStrings } from "./utils";

export type FhevmContractName = "ACL" | "KMSVerifier" | "TFHEExecutor" | "GatewayContract";
export const AllFhevmContractNames: FhevmContractName[] = ["ACL", "KMSVerifier", "TFHEExecutor", "GatewayContract"];

export function toFhevmContractName(s: string): FhevmContractName {
  if ((AllFhevmContractNames as string[]).includes(s)) {
    return s as FhevmContractName;
  }
  throw new HardhatFhevmError(`Invalid fhevm contract name ${s} (expecting ${AllFhevmContractNames.join(", ")})`);
}

export type FhevmContractParams = {
  contractName: FhevmContractName;
  contractImportDir: string;
  fullyQualifiedName: string;
  contractFilename: string;
  contractDir: string;
  contractAddressFilename: string;
  contractAddressPath: string;
  contractAddressImportDir: string;
  dotenvFilename: string;
  dotenvPath: string;
  envVarName: string;
  solidityVarName: string;
  nonce: number;
};

// Also equal to GATEWAY__ETHEREUM__FHE_LIB_ADDRESS in docker-compose-full.yml
export const EXT_TFHE_LIBRARY = "0x000000000000000000000000000000000000005d";
const FHEVM_SOL_IMPORT_PATH = "fhevm";
const FHEVM_LIB_SOL_IMPORT_PATH = "fhevm/lib";
const FHEVM_GATEWAY_SOL_IMPORT_PATH = "fhevm/gateway";
const FHEVM_GATEWAY_LIB_SOL_IMPORT_PATH = "fhevm/gateway/lib";

// usually: /path/to/user_package/node_modules
export function getUserPackageNodeModulesDir(config: HardhatConfig): string {
  // must be absolute
  const p = path.join(config.paths.root, "node_modules");
  assert(p === config.paths.fhevmContracts);
  return config.paths.fhevmContracts;
}

// usually: /path/to/user_package/node_modules/fhevm
export function getFhevmContractsDirectory(contractsRootDir: string): string {
  return path.join(contractsRootDir, FHEVM_SOL_IMPORT_PATH);
}

// usually: /path/to/user_package/node_modules/fhevm/lib
function getFhevmLibDir(contractsRootDir: string): string {
  return path.join(contractsRootDir, FHEVM_LIB_SOL_IMPORT_PATH);
}

// usually: /path/to/user_package/node_modules/fhevm/gateway
function getFhevmGatewayDir(contractsRootDir: string): string {
  return path.join(contractsRootDir, FHEVM_GATEWAY_SOL_IMPORT_PATH);
}

// usually: /path/to/user_package/node_modules/fhevm/gateway/lib
function getFhevmGatewayLibDir(contractsRootDir: string): string {
  return path.join(contractsRootDir, FHEVM_GATEWAY_LIB_SOL_IMPORT_PATH);
}

// usually: /path/to/user_package/node_modules/fhevm/gateway/lib/Gateway.sol
function getLibGatewayDotSolPath(hre: HardhatRuntimeEnvironment) {
  const rootDir = getUserPackageNodeModulesDir(hre.config);
  const contractDir = getFhevmGatewayLibDir(rootDir);
  return path.join(contractDir, "Gateway.sol");
}

////////////////////////////////////////////////////////////////////////////////
// Wallets
////////////////////////////////////////////////////////////////////////////////

export function getFhevmContractDeployerSigner(contractName: FhevmContractName, hre: HardhatRuntimeEnvironment) {
  switch (contractName) {
    case "ACL":
      return getACLDeployerSigner(hre);
    case "KMSVerifier":
      return getKMSVerifierDeployerSigner(hre);
    case "TFHEExecutor":
      return getTFHEExecutorDeployerSigner(hre);
    case "GatewayContract":
      return getGatewayDeployerWallet(hre);
  }
}

export function getFhevmContractOwnerSigner(contractName: FhevmContractName, hre: HardhatRuntimeEnvironment) {
  switch (contractName) {
    case "ACL":
      return getACLOwnerSigner(hre);
    case "KMSVerifier":
      return getKMSVerifierOwnerSigner(hre);
    case "TFHEExecutor":
      return getTFHEExecutorOwnerSigner(hre);
    case "GatewayContract":
      return getGatewayOwnerWallet(hre);
  }
}

export function getACLOwnerSigner(hre: HardhatRuntimeEnvironment): ethers.HDNodeWallet {
  assert(hre.config.networks.fhevm.accounts.fhevmOwner === 9);
  return getWalletAt(hre.config.networks.fhevm.accounts.fhevmOwner, hre.config, hre.fhevm.provider());
}

// Deployer is Owner
export function getACLDeployerSigner(hre: HardhatRuntimeEnvironment): ethers.HDNodeWallet {
  return getACLOwnerSigner(hre);
}

export function getKMSVerifierOwnerSigner(hre: HardhatRuntimeEnvironment): ethers.HDNodeWallet {
  assert(hre.config.networks.fhevm.accounts.fhevmOwner === 9);
  return getWalletAt(hre.config.networks.fhevm.accounts.fhevmOwner, hre.config, hre.fhevm.provider());
}

// Deployer is Owner
export function getKMSVerifierDeployerSigner(hre: HardhatRuntimeEnvironment): ethers.HDNodeWallet {
  return getKMSVerifierOwnerSigner(hre);
}

export function getTFHEExecutorOwnerSigner(hre: HardhatRuntimeEnvironment): ethers.HDNodeWallet {
  assert(hre.config.networks.fhevm.accounts.fhevmOwner === 9);
  return getWalletAt(hre.config.networks.fhevm.accounts.fhevmOwner, hre.config, hre.fhevm.provider());
}

// Deployer is Owner
export function getTFHEExecutorDeployerSigner(hre: HardhatRuntimeEnvironment): ethers.HDNodeWallet {
  return getTFHEExecutorOwnerSigner(hre);
}

export function getGatewayDeployerWallet(hre: HardhatRuntimeEnvironment): ethers.HDNodeWallet {
  return getWalletAt(hre.config.networks.fhevm.accounts.GatewayContractDeployer, hre.config, hre.fhevm.provider());
}

export function getGatewayOwnerWallet(hre: HardhatRuntimeEnvironment): ethers.HDNodeWallet {
  return getWalletAt(hre.config.networks.fhevm.accounts.GatewayContractOwner, hre.config, hre.fhevm.provider());
}

/**
 * - `ACL.sol` is standalone and has no dependency.
 * - `TFHEExecutor.sol`, `Gateway.sol` depends on `ACL.sol`
 * - `Impl.sol`, `TFHEExecutor.sol`, `Gateway.sol` depends on `ACLAddress.sol`
 */
export function getACLParams(contractsRootDir: string): FhevmContractParams {
  const contractName = "ACL";
  const importDir = FHEVM_LIB_SOL_IMPORT_PATH;
  const contractDir = getFhevmLibDir(contractsRootDir);
  const contractAddressFilename = "ACLAddress.sol";
  const dotenvFilename = ".env.acl";

  return {
    contractName,
    contractImportDir: importDir,
    fullyQualifiedName: `${importDir}/${contractName}.sol:${contractName}`,
    contractDir,
    contractFilename: `${contractName}.sol`,
    contractAddressFilename,
    contractAddressPath: path.join(contractDir, contractAddressFilename),
    contractAddressImportDir: importDir,
    dotenvFilename,
    dotenvPath: path.join(contractDir, dotenvFilename),
    solidityVarName: "aclAdd",
    envVarName: "ACL_CONTRACT_ADDRESS",
    nonce: 0,
  };
}

/**
 * - `KMSVerifier.sol` is standalone and has no dependency.
 * - `Gateway.sol`, `GatewayContract.sol` depends on `KMSVerifier.sol`
 * - `Gateway.sol` depends on `KMSVerifierAddress.sol`
 */
export function getKMSVerifierParams(contractsRootDir: string): FhevmContractParams {
  const contractName = "KMSVerifier";
  const importDir = FHEVM_LIB_SOL_IMPORT_PATH;
  const contractDir = getFhevmLibDir(contractsRootDir);
  const contractAddressFilename = "KMSVerifierAddress.sol";
  const dotenvFilename = ".env.kmsverifier";

  return {
    contractName,
    contractImportDir: importDir,
    fullyQualifiedName: `${importDir}/${contractName}.sol:${contractName}`,
    contractDir,
    contractFilename: `${contractName}.sol`,
    contractAddressFilename,
    contractAddressPath: path.join(contractDir, contractAddressFilename),
    contractAddressImportDir: importDir,
    dotenvFilename,
    dotenvPath: path.join(contractDir, dotenvFilename),
    solidityVarName: "KMS_VERIFIER_CONTRACT_ADDRESS",
    envVarName: "KMS_VERIFIER_CONTRACT_ADDRESS",
    nonce: 2,
  };
}

/**
 * - `TFHEExecutor.sol` depends on `ACL.sol` and `ACLAddress.sol`.
 * - `Impl.sol` depends on `FHEVMCoprocessorAddress.sol`
 */
export function getTFHEExecutorParams(contractsRootDir: string): FhevmContractParams {
  const contractName = "TFHEExecutor";
  const importDir = FHEVM_LIB_SOL_IMPORT_PATH;
  const contractDir = getFhevmLibDir(contractsRootDir);
  const contractAddressFilename = "FHEVMCoprocessorAddress.sol";
  const dotenvFilename = ".env.exec";

  return {
    contractName,
    contractImportDir: importDir,
    fullyQualifiedName: `${importDir}/${contractName}.sol:${contractName}`,
    contractDir,
    contractFilename: `${contractName}.sol`,
    contractAddressFilename,
    contractAddressPath: path.join(contractDir, contractAddressFilename),
    contractAddressImportDir: importDir,
    dotenvFilename,
    dotenvPath: path.join(contractDir, dotenvFilename),
    solidityVarName: "fhevmCoprocessorAdd",
    envVarName: "TFHE_EXECUTOR_CONTRACT_ADDRESS",
    nonce: 1,
  };
}

/**
 * - `GatewayContract.sol` depends on `KMSVerifier.sol`
 * - `GatewayCaller.sol` depends on `GatewayContract.sol`
 */
export function getGatewayContractParams(contractsRootDir: string): FhevmContractParams {
  const contractName = "GatewayContract";
  const importDir = FHEVM_GATEWAY_SOL_IMPORT_PATH;
  const contractDir = getFhevmGatewayDir(contractsRootDir);
  const contractAddressFilename = "PredeployAddress.sol";
  const dotenvFilename = ".env.gateway";

  return {
    contractName,
    contractImportDir: importDir,
    fullyQualifiedName: `${importDir}/${contractName}.sol:${contractName}`,
    contractDir,
    contractFilename: `${contractName}.sol`,
    contractAddressFilename,
    contractAddressPath: path.join(getFhevmGatewayLibDir(contractsRootDir), contractAddressFilename),
    contractAddressImportDir: FHEVM_GATEWAY_LIB_SOL_IMPORT_PATH,
    dotenvFilename,
    dotenvPath: path.join(contractDir, dotenvFilename),
    solidityVarName: "GATEWAY_CONTRACT_PREDEPLOY_ADDRESS",
    envVarName: "GATEWAY_CONTRACT_PREDEPLOY_ADDRESS",
    nonce: 0, // deployer is supposed to have nonce 0 when deploying GatewayContract
  };
}

export function getFhevmContractParams(contractName: FhevmContractName, contractsRootDir: string) {
  switch (contractName) {
    case "ACL":
      return getACLParams(contractsRootDir);
    case "KMSVerifier":
      return getKMSVerifierParams(contractsRootDir);
    case "TFHEExecutor":
      return getTFHEExecutorParams(contractsRootDir);
    case "GatewayContract":
      return getGatewayContractParams(contractsRootDir);
    default:
      throw new HardhatFhevmError(`Unknown contract name ${contractName}`);
  }
}

/**
 * Always returns a checksum address
 */
export function readFhevmContractAddress(
  params: FhevmContractParams | FhevmContractName,
  contractsRootDir: string,
): string {
  try {
    // Never call toLowerCase!!!!
    if (typeof params === "string") {
      params = getFhevmContractParams(params, contractsRootDir);
    }
    const parsedEnv = dotenv.parse(fs.readFileSync(params.dotenvPath));
    return ethers.getAddress(parsedEnv[params.envVarName]);
  } catch {
    return "";
  }
}

export function readACLAddress(contractsRootDir: string): string {
  return readFhevmContractAddress("ACL", contractsRootDir);
}

export function readTFHEExecutorAddress(contractsRootDir: string): string {
  return readFhevmContractAddress("TFHEExecutor", contractsRootDir);
}

export function readKMSVerifierAddress(contractsRootDir: string): string {
  return readFhevmContractAddress("KMSVerifier", contractsRootDir);
}

export function readGatewayContractAddress(contractsRootDir: string): string {
  return readFhevmContractAddress("GatewayContract", contractsRootDir);
}

async function getContractFactory(contractName: FhevmContractName, hre: HardhatRuntimeEnvironment) {
  const params = getFhevmContractParams(contractName, getUserPackageNodeModulesDir(hre.config));
  const artifact = await hre.artifacts.readArtifact(params.fullyQualifiedName);
  return hre.ethers.getContractFactoryFromArtifact(artifact, getWalletAt(0, hre.config, hre.fhevm.provider()));
  //  const factory = await hre.ethers.getContractFactory(params.fullyQualifiedName);
}

// Only Mock
export async function getMockACL(hre: HardhatRuntimeEnvironment) {
  assert(hre.fhevm.isMock());
  const factory = await getContractFactory("ACL", hre);
  const address = readACLAddress(getUserPackageNodeModulesDir(hre.config));
  return factory.attach(address);
}

export async function getGatewayContract(hre: HardhatRuntimeEnvironment) {
  const factory = await getContractFactory("GatewayContract", hre);
  const address = readGatewayContractAddress(getUserPackageNodeModulesDir(hre.config));
  return factory.attach(address);
}

export function checkArtifacts(hre: HardhatRuntimeEnvironment): boolean {
  try {
    hre.artifacts.readArtifactSync(getKMSVerifierParams(getUserPackageNodeModulesDir(hre.config)).fullyQualifiedName);
    hre.artifacts.readArtifactSync(getACLParams(getUserPackageNodeModulesDir(hre.config)).fullyQualifiedName);
    hre.artifacts.readArtifactSync(
      getGatewayContractParams(getUserPackageNodeModulesDir(hre.config)).fullyQualifiedName,
    );
    hre.artifacts.readArtifactSync(getTFHEExecutorParams(getUserPackageNodeModulesDir(hre.config)).fullyQualifiedName);
    return true;
  } catch {
    return false;
  }
}

export function getFhevmContractInstallNeeded(
  contractName: FhevmContractName,
  hre: HardhatRuntimeEnvironment,
): boolean {
  const { currentAddress, nextAddress } = getFhevmContractAddressInfo(contractName, hre);
  return (
    currentAddress.length === 0 ||
    (currentAddress !== nextAddress && currentAddress.length > 0 && nextAddress.length > 0)
  );
}

export function getFhevmContractAddressInfo(
  contractName: FhevmContractName,
  hre: HardhatRuntimeEnvironment,
): { currentAddress: string; nextAddress: string } {
  const params = getFhevmContractParams(contractName, getUserPackageNodeModulesDir(hre.config));
  const currentAddress = readFhevmContractAddress(params, getUserPackageNodeModulesDir(hre.config));
  const deployerAddress = getFhevmContractDeployerSigner(contractName, hre).address;
  const nextAddress = computeContractAddress(contractName, deployerAddress, hre);
  assert(nextAddress.length > 0, "computeContractAddress failed!");

  return {
    currentAddress,
    nextAddress,
  };
}

export function getFhevmContractBuildInfo(contractName: FhevmContractName, hre: HardhatRuntimeEnvironment) {
  const { currentAddress, nextAddress } = getFhevmContractAddressInfo(contractName, hre);
  const params = getFhevmContractParams(contractName, getUserPackageNodeModulesDir(hre.config));
  // const currentAddress = readFhevmContractAddress(params, getUserPackageNodeModulesDir(hre.config));
  // const deployer = getFhevmContractDeployerSigner(contractName, hre);
  // const nextAddress = computeContractAddress(contractName, deployer.address, hre);
  // assert(nextAddress.length > 0, "computeContractAddress failed!");

  let artifact = null;
  try {
    artifact = hre.artifacts.readArtifactSync(params.fullyQualifiedName);
  } catch {
    artifact = null;
  }

  return {
    currentAddress,
    nextAddress,
    artifact,
    build: currentAddress.length === 0 || !artifact,
    clean: currentAddress !== nextAddress && currentAddress.length > 0 && nextAddress.length > 0,
  };
}

export function cleanOrBuildNeeded(hre: HardhatRuntimeEnvironment): { clean: boolean; build: boolean } {
  const names: FhevmContractName[] = ["ACL", "KMSVerifier", "GatewayContract", "TFHEExecutor"];
  const res = {
    clean: false,
    build: false,
  };
  for (let i = 0; i < names.length; ++i) {
    const info = getFhevmContractBuildInfo(names[i], hre);
    if (info.clean) {
      res.clean = true;
      res.build = true;
    }
    if (info.build) {
      res.build = true;
    }
  }
  return res;
}

export function getTFHEExecutorArtifact(hre: HardhatRuntimeEnvironment): Artifact {
  return hre.artifacts.readArtifactSync(
    getTFHEExecutorParams(getUserPackageNodeModulesDir(hre.config)).fullyQualifiedName,
  );
}

export function computeContractAddress(
  contractName: FhevmContractName,
  deployerAddress: string | undefined,
  hre: HardhatRuntimeEnvironment,
) {
  if (!deployerAddress) {
    deployerAddress = getFhevmContractDeployerSigner(contractName, hre).address;
  }
  const params = getFhevmContractParams(contractName, getUserPackageNodeModulesDir(hre.config));
  return hre.ethers.getCreateAddress({
    from: deployerAddress,
    nonce: params.nonce,
  });
}

/**
 * returns `true` if "Gateway.sol" has changed
 */
export function writeLibGateway(
  contractAddresses: { ACL: string; KMSVerifier: string; GatewayContract: string },
  hre: HardhatRuntimeEnvironment,
): boolean {
  const p = getLibGatewayDotSolPath(hre);

  try {
    const content = fs.readFileSync(p, "utf8");

    const hasGatewayContract = content.includes(`GatewayContract(${contractAddresses.GatewayContract})`);
    const hasACL = content.includes(`ACL(${contractAddresses.ACL})`);
    const hasKMSVerifier = content.includes(`KMSVerifier(address(${contractAddresses.KMSVerifier}))`);

    if (hasGatewayContract && hasACL && hasKMSVerifier) {
      return false;
    }

    const new_content = replaceStrings(content, [
      ["0xc8c9303Cd7F337fab769686B593B87DC3403E0ce", contractAddresses.GatewayContract],
      ["0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92", contractAddresses.ACL],
      ["0x12B064FB845C1cc05e9493856a1D637a73e944bE", contractAddresses.KMSVerifier],
    ]);

    fs.writeFileSync(p, new_content, { encoding: "utf8", flag: "w" });

    logTrace(`write fhevm Gateway.sol contract`);

    return true;
  } catch (error) {
    throw new HardhatFhevmError(`Write ${p} failed. ${error}`);
  }
}

export function writeImportSolFile(hre: HardhatRuntimeEnvironment) {
  // Write solidity file
  const solidityTemplate = `// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/lib/ACL.sol";
import "fhevm/lib/KMSVerifier.sol";
import "fhevm/lib/TFHEExecutor.sol";
import "fhevm/gateway/GatewayContract.sol";
import "fhevm/gateway/GatewayCaller.sol";
\n`;

  try {
    const dir = path.join(hre.config.paths.fhevm, "contracts/imports");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "imports.sol"), solidityTemplate, { encoding: "utf8", flag: "w" });
    return dir;
  } catch (err) {
    throw new HardhatFhevmError(`Failed to generate 'imports.sol' file: ${err}`);
  }
}

export function writePrecompileSolFile(hre: HardhatRuntimeEnvironment) {
  // Write solidity file
  const solidityTemplate = `// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "fhevm/lib/MockedPrecompile.sol";
\n`;

  try {
    const dir = path.join(hre.config.paths.fhevm, "contracts/precompile");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "imports.sol"), solidityTemplate, { encoding: "utf8", flag: "w" });
    return dir;
  } catch (err) {
    throw new HardhatFhevmError(`Failed to generate 'imports.sol' file: ${err}`);
  }
}

export function writeContractAddress(
  contractName: FhevmContractName,
  deployerAddress: string | undefined,
  hre: HardhatRuntimeEnvironment,
) {
  if (!deployerAddress) {
    deployerAddress = getFhevmContractDeployerSigner(contractName, hre).address;
  }

  const params = getFhevmContractParams(contractName, getUserPackageNodeModulesDir(hre.config));

  logTrace(`write fhevm ${params.contractFilename} contract.`);

  const contractAddress = ethers.getCreateAddress({
    from: deployerAddress,
    nonce: params.nonce,
  });

  const previousAddress = readFhevmContractAddress(params, getUserPackageNodeModulesDir(hre.config));

  const dotenvDir = path.dirname(params.dotenvPath);
  if (!fs.existsSync(dotenvDir)) {
    throw new HardhatFhevmError(`Directory ${dotenvDir} does not exits`);
  }

  const contractDir = path.dirname(params.contractAddressPath);
  if (!fs.existsSync(dotenvDir)) {
    throw new HardhatFhevmError(`Directory ${contractDir} does not exits`);
  }

  // Write env file
  const content = `${params.envVarName}=${contractAddress}\n`;
  try {
    fs.writeFileSync(params.dotenvPath, content, { flag: "w" });
  } catch (err) {
    throw new HardhatFhevmError(`Failed to write ACL address env file: ${err}`);
  }

  // Write solidity file
  const solidityTemplate = `// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

address constant ${params.solidityVarName} = ${contractAddress};\n`;

  try {
    fs.writeFileSync(params.contractAddressPath, solidityTemplate, { encoding: "utf8", flag: "w" });
  } catch (err) {
    throw new HardhatFhevmError(`Failed to write ACL address solidity file: ${err}`);
  }

  return {
    address: contractAddress,
    solPath: params.contractAddressPath,
    envPath: params.dotenvPath,
    changed: contractAddress !== previousAddress,
  };
}

export function getMnemonicPhrase(config: HardhatConfig): string {
  const hdAccounts = getHDAccounts(config);
  return hdAccounts.mnemonic;
}

export function getWalletAt(
  index: number,
  config: HardhatConfig,
  provider: ethers.Provider | null,
): ethers.HDNodeWallet {
  const hdAccounts = getHDAccounts(config);
  const mnemonic = ethers.Mnemonic.fromPhrase(hdAccounts.mnemonic);
  if (!mnemonic) {
    throw new HardhatFhevmError("Invalid mnemonic in HardhatRuntimeEnvironment.config.networks.fhevm.accounts");
  }
  const rootWallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, hdAccounts.path);
  return rootWallet.deriveChild(index).connect(provider);
}

export function getWalletAddressAt(index: number, config: HardhatConfig): string {
  return getWalletAt(index, config, null).address;
}

function getHDAccounts(config: HardhatConfig): HardhatNetworkHDAccountsConfig {
  const accounts = config.networks.fhevm.accounts;
  if (typeof accounts === "string") {
    throw new HardhatFhevmError("Hardhat network config does not contain mnemonic");
  } else if (Array.isArray(accounts)) {
    throw new HardhatFhevmError("Hardhat network config does not contain mnemonic");
  } else {
    return accounts;
  }
}

export async function deployFhevmContract(
  contractName: FhevmContractName,
  /* eslint-disable  @typescript-eslint/no-explicit-any */
  args: any[],
  hre: HardhatRuntimeEnvironment,
) {
  const deployer = getFhevmContractDeployerSigner(contractName, hre);

  let address;
  let expectedAddr;
  try {
    const params = getFhevmContractParams(contractName, getUserPackageNodeModulesDir(hre.config));
    expectedAddr = readFhevmContractAddress(params, getUserPackageNodeModulesDir(hre.config));
    const factory = await getContractFactory(contractName, hre);
    const contract = await factory.connect(deployer).deploy(...args);
    await contract.waitForDeployment();
    address = await contract.getAddress();
  } catch (err) {
    throw new HardhatFhevmError(`Deploy contract ${contractName} failed (signer=${deployer.address}), ${err}`);
  }

  if (address.toLowerCase() !== expectedAddr.toLowerCase()) {
    throw new HardhatFhevmError(
      `The nonce of the deployer account is not corret. Please relaunch a clean instance of the fhEVM`,
    );
  }

  logDim(`${contractName.padEnd(15, " ")} deployed at ${address} (deployer=${deployer.address})`);

  return address;
}
