import assert from "assert";
import dotenv from "dotenv";
import { Artifact, HardhatConfig, HardhatRuntimeEnvironment, ProjectPathsConfig } from "hardhat/types";
import {
  AllReleasedZamaContractNames,
  AllZamaContractNames,
  ZamaContractName,
  ZamaDev,
  ZamaDevConfig,
  ZamaDevContractConfig,
} from "../constants";
import { walletFromMnemonic } from "../wallet";
import fs from "fs";
import path from "path";
import { HardhatFhevmError } from "../error";
import { deployContract, isDeployed, replaceStrings } from "../utils";
import { ethers as EthersT } from "ethers";
import { logDim, LogOptions, logTrace } from "../log";
import { getImportsDir, getPackageDir, getPrecompileDir } from "../dirs";

/**
 * Unused helper
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
function _toZamaContractName(s: string): ZamaContractName {
  if ((AllZamaContractNames as string[]).includes(s)) {
    return s as ZamaContractName;
  }
  throw new HardhatFhevmError(`Invalid fhevm contract name ${s} (expecting ${AllZamaContractNames.join(", ")})`);
}

function _getDeployerWallet(contractName: ZamaContractName, config: ZamaDevConfig, provider: EthersT.Provider | null) {
  return walletFromMnemonic(
    config.contracts[contractName].deployer,
    config.deployer.mnemonic,
    config.deployer.path,
    provider,
  );
}

function _computeZamaContractAddress(contractName: ZamaContractName, config: ZamaDevConfig) {
  const deployer = _getDeployerWallet(contractName, config, null);
  const deployerAddress = deployer.address;
  return EthersT.getCreateAddress({
    from: deployerAddress,
    nonce: config.contracts[contractName].nonce,
  });
}

/**
 * Parse contract address stored in env file.
 * Example: Parse `fhevm/lib/.env.acl` to retreive `ACL` address
 * Always returns a checksum address
 */
function _readZamaContractAddressFromEnvFileSync(
  contractName: ZamaContractName,
  contractsRootDir: string,
  config: ZamaDevConfig,
): string | undefined {
  config = config ?? ZamaDev;
  const c = config.contracts[contractName];
  if (!c.envVar) {
    return undefined;
  }
  const p = path.join(contractsRootDir, c.envVar.dotenvDir, c.envVar.dotenvFilename);
  const e = c.envVar.name;
  if (!e) {
    throw new HardhatFhevmError(`Missing contact ${contractName} env var name`);
  }

  try {
    const parsedEnv = dotenv.parse(fs.readFileSync(p));
    assert(EthersT, "import ethers failed");
    return EthersT.getAddress(parsedEnv[e]);
  } catch {
    return undefined;
  }
}

/**
 * Unused helper:
 * Parse contract address stored in address solidity file.
 * Example: Parse `fhevm/gateway/lib/GatewayContractAddress.sol` to retreive `GatewayContract` address
 * Always returns a checksum address
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
function _readZamaContractAddressFromSol2idityFileSync(
  contractName: ZamaContractName,
  contractsRootDir: string,
  config: ZamaDevConfig,
  hre: HardhatRuntimeEnvironment,
): string | undefined {
  const c = config.contracts[contractName];
  if (!c.solidityVarName) {
    return undefined;
  }
  const p = path.join(contractsRootDir, c.contractAddressImportDir, c.contractAddressFilename);
  try {
    const content = fs.readFileSync(p, "utf8");
    const i = content.indexOf(c.solidityVarName);
    if (i < 0) {
      return "";
    }
    let s = content.substring(i + c.solidityVarName.length).trimStart();
    if (!s.startsWith("=")) {
      return "";
    }
    s = s.substring(1).trimStart();
    const j = s.indexOf(";");
    if (j < 0) {
      return "";
    }
    s = s.substring(0, j).trimEnd();
    return hre.ethers.getAddress(s);
  } catch {
    return "";
  }
}

// hre needed
function _getZamaContractBuildInfos(
  contractName: ZamaContractName,
  contractsRootDir: string,
  config: ZamaDevConfig,
  hre: HardhatRuntimeEnvironment,
) {
  const { currentAddress, nextAddress } = _getZamaContractAddressInfos(contractName, contractsRootDir, config);

  let artifact = null;
  try {
    artifact = _readZamaContractArtifactSync(contractName, config, hre);
  } catch {
    artifact = null;
  }

  return {
    currentAddress,
    nextAddress,
    artifact,
    build: !currentAddress || !artifact,
    clean: currentAddress !== nextAddress && currentAddress !== undefined,
  };
}

function _getZamaContractAddressInfos(
  contractName: ZamaContractName,
  contractsRootDir: string,
  config: ZamaDevConfig,
): { currentAddress: string | undefined; nextAddress: string; dotenvPath: string; contractAddressPath: string } {
  const currentAddress = _readZamaContractAddressFromEnvFileSync(contractName, contractsRootDir, config);
  const nextAddress = _computeZamaContractAddress(contractName, config);
  assert(nextAddress.length > 0, "computeContractAddress failed!");

  const c: ZamaDevContractConfig = config.contracts[contractName];
  assert(c.envVar);

  const dotenvPath = path.join(contractsRootDir, c.envVar.dotenvDir, c.envVar.dotenvFilename);
  const contractAddressPath = path.join(contractsRootDir, c.contractAddressImportDir, c.contractAddressFilename);

  return {
    currentAddress,
    nextAddress,
    dotenvPath,
    contractAddressPath,
  };
}

// hre needed
async function _getZamaContractFactory(
  contractName: ZamaContractName,
  config: ZamaDevConfig,
  provider: EthersT.Provider,
  hre: HardhatRuntimeEnvironment,
) {
  const artifact = await _readZamaContractArtifact(contractName, config, hre);
  return hre.ethers.getContractFactoryFromArtifact(artifact, _getDeployerWallet(contractName, config, provider));
}

// hre needed
function _readZamaContractArtifactSync(
  contractName: ZamaContractName,
  config: ZamaDevConfig,
  hre: HardhatRuntimeEnvironment,
): Artifact {
  const fqn = config.contracts[contractName].fullyQualifiedName;
  return hre.artifacts.readArtifactSync(fqn);
}

// hre needed
function _readZamaContractArtifact(
  contractName: ZamaContractName,
  config: ZamaDevConfig,
  hre: HardhatRuntimeEnvironment,
): Promise<Artifact> {
  const fqn = config.contracts[contractName].fullyQualifiedName;
  return hre.artifacts.readArtifact(fqn);
}

////////////////////////////////////////////////////////////////////////////////
// Write contract
////////////////////////////////////////////////////////////////////////////////

function _writeAllZamaContractsSync(
  ifNeeded: boolean,
  contractsRootDir: string,
  config: ZamaDevConfig,
  logOptions: LogOptions,
) {
  // Write ACL.sol
  const ACL_res = _writeZamaContractAddressIfNeededSync("ACL", ifNeeded, contractsRootDir, config);

  // Write TFHEExecutor.sol
  _writeZamaContractAddressIfNeededSync("TFHEExecutor", ifNeeded, contractsRootDir, config);

  // Write KMSVerifier.sol
  const KMSVerifier_res = _writeZamaContractAddressIfNeededSync("KMSVerifier", ifNeeded, contractsRootDir, config);

  // Write GatewayContract.sol
  const GatewayContract_res = _writeZamaContractAddressIfNeededSync(
    "GatewayContract",
    ifNeeded,
    contractsRootDir,
    config,
  );

  // Write Gateway.sol
  _writeLibGatewaySync(
    { ACL: ACL_res.address, GatewayContract: GatewayContract_res.address, KMSVerifier: KMSVerifier_res.address },
    contractsRootDir,
    config,
    logOptions,
  );
}

function _writeZamaContractAddressIfNeededSync(
  contractName: ZamaContractName,
  ifNeeded: boolean,
  contractsRootDir: string,
  config: ZamaDevConfig,
) {
  if (ifNeeded) {
    const { currentAddress, nextAddress, dotenvPath, contractAddressPath } = _getZamaContractAddressInfos(
      contractName,
      contractsRootDir,
      config,
    );
    assert(nextAddress);

    const isCurrentlyInstalled = currentAddress && currentAddress.length > 0;
    const addressHasChanged = currentAddress !== nextAddress;

    if (isCurrentlyInstalled && !addressHasChanged) {
      return {
        address: currentAddress,
        changed: false,
        contractAddressPath,
        dotenvPath,
      };
    }
  }

  return _writeZamaContractAddressSync(contractName, contractsRootDir, config);
}

function _writeZamaContractAddressSync(
  contractName: ZamaContractName,
  contractsRootDir: string,
  config: ZamaDevConfig,
) {
  const c: ZamaDevContractConfig = config.contracts[contractName];
  assert(c.envVar);

  const { currentAddress, nextAddress, dotenvPath, contractAddressPath } = _getZamaContractAddressInfos(
    contractName,
    contractsRootDir,
    config,
  );

  const dotenvDir = path.dirname(dotenvPath);
  if (!fs.existsSync(dotenvDir)) {
    throw new HardhatFhevmError(`Directory ${dotenvDir} does not exits`);
  }

  const contractAddressDir = path.dirname(contractAddressPath);
  if (!fs.existsSync(contractAddressDir)) {
    throw new HardhatFhevmError(`Directory ${contractAddressDir} does not exits`);
  }

  // Write env file
  const content = `${c.envVar.name}=${nextAddress}\n`;
  try {
    fs.writeFileSync(dotenvPath, content, { flag: "w" });
  } catch (err) {
    throw new HardhatFhevmError(`Failed to write ${contractName} address env file: ${err}`);
  }

  // Write solidity file
  const solidityTemplate = `// SPDX-License-Identifier: BSD-3-Clause-Clear
    pragma solidity ^0.8.24;
  
    address constant ${c.solidityVarName} = ${nextAddress};\n`;

  try {
    fs.writeFileSync(contractAddressPath, solidityTemplate, { encoding: "utf8", flag: "w" });
  } catch (err) {
    throw new HardhatFhevmError(`Failed to write ACL address solidity file: ${err}`);
  }

  return {
    address: nextAddress,
    changed: nextAddress !== currentAddress,
    contractAddressPath,
    dotenvPath,
  };
}

function _extractAddr(content: string, prefix: string, suffix: string) {
  const prefix_index = content.indexOf(prefix);
  const suffix_index = content.indexOf(suffix, prefix_index + prefix.length);

  if (prefix_index < 0 || suffix_index !== prefix_index + 40 + prefix.length) {
    return undefined;
  }

  const addr = content.substring(prefix_index + prefix.length - 2, suffix_index);
  assert(addr.length === 42);
  assert(EthersT, "import ethers failed");
  assert(EthersT.isAddress(addr));
  return addr;
}

/**
 * returns `true` if "Gateway.sol" has changed
 */
function _writeLibGatewaySync(
  contractAddresses: { ACL: string; KMSVerifier: string; GatewayContract: string },
  contractsRootDir: string,
  config: ZamaDevConfig,
  logOptions: LogOptions,
): boolean {
  const gatewayDotSol = path.join(
    contractsRootDir,
    config.contracts["GatewayContract"].contractImportDir,
    "lib",
    "Gateway.sol",
  );

  if (!fs.existsSync(gatewayDotSol)) {
    throw new HardhatFhevmError(`File ${gatewayDotSol} does not exist`);
  }

  try {
    const content = fs.readFileSync(gatewayDotSol, "utf8");
    const gatewayContractAddress = _extractAddr(
      content,
      "GatewayContract constant gatewayContract = GatewayContract(0x",
      "); // Replace by GatewayContract address",
    );
    if (!gatewayContractAddress) {
      throw new HardhatFhevmError(`File ${gatewayDotSol} cannot be parsed. Cannot find GatewayContract address.`);
    }

    const aclAddress = _extractAddr(content, "ACL constant acl = ACL(0x", "); // Replace by ACL address");
    if (!aclAddress) {
      throw new HardhatFhevmError(`File ${gatewayDotSol} cannot be parsed. Cannot find ACL address.`);
    }

    const kmsVerifierAddress = _extractAddr(
      content,
      "KMSVerifier constant kmsVerifier = KMSVerifier(address(0x",
      "));",
    );
    if (!kmsVerifierAddress) {
      throw new HardhatFhevmError(`File ${gatewayDotSol} cannot be parsed. Cannot find KMSVerifier address.`);
    }

    if (
      gatewayContractAddress === contractAddresses.GatewayContract &&
      aclAddress === contractAddresses.ACL &&
      kmsVerifierAddress === contractAddresses.KMSVerifier
    ) {
      return false;
    }

    const new_content = replaceStrings(content, [
      [gatewayContractAddress, contractAddresses.GatewayContract],
      [aclAddress, contractAddresses.ACL],
      [kmsVerifierAddress, contractAddresses.KMSVerifier],
    ]);

    fs.writeFileSync(gatewayDotSol, new_content, { encoding: "utf8", flag: "w" });

    logTrace(`write fhevm Gateway.sol contract`, logOptions);

    return true;
  } catch (error) {
    throw new HardhatFhevmError(`Write ${gatewayDotSol} failed. ${error}`);
  }
}

function _restoreOverridedSolFile(paths: ProjectPathsConfig) {
  const file = "fhevm/lib/TFHEExecutor.sol";
  const file_save = file + ".orig";

  const src_save = path.join(paths.root, "node_modules", file_save);
  const dst = path.join(paths.root, "node_modules", file);

  // if TFHEExecutor.sol.orig exists
  // rm TFHEExecutor.sol
  // cp TFHEExecutor.sol.orig TFHEExecutor.sol
  if (fs.existsSync(src_save)) {
    if (fs.existsSync(dst)) {
      fs.rmSync(dst);
    }
    fs.copyFileSync(src_save, dst);
  }
}

function _writeOverridesSolFile(paths: ProjectPathsConfig) {
  const file = "fhevm/lib/TFHEExecutor.sol";
  const file_save = file + ".orig";

  const src = path.join(getPackageDir(), "solidity", file);
  const dst = path.join(paths.root, "node_modules", file);
  const dst_save = path.join(paths.root, "node_modules", file_save);

  if (!fs.existsSync(src)) {
    throw new HardhatFhevmError(`File ${src} does not exist`);
  }

  if (!fs.existsSync(dst) && !fs.existsSync(dst_save)) {
    // https://raw.githubusercontent.com/zama-ai/fhevm/92bb963aea278e7d3b4a51ed430bfd730a622eec/lib/TFHEExecutor.sol
    throw new HardhatFhevmError(`Corrupted fhevm package, please reinstall.`);
  }

  // Keep a copy of the original file
  if (!fs.existsSync(dst_save)) {
    fs.copyFileSync(dst, dst_save);
  }

  if (fs.existsSync(dst)) {
    fs.rmSync(dst);
  }

  fs.copyFileSync(src, dst);
}

// fhevmPath = hre.config.paths.fhevm
function _writeImportSolFile(fhevmPath: string) {
  // Write solidity file
  const solidityTemplate = `// SPDX-License-Identifier: BSD-3-Clause-Clear
    pragma solidity ^0.8.24;
    
    import {TFHE} from "fhevm/lib/TFHE.sol";
    import {ACL} from "fhevm/lib/ACL.sol";
    import {KMSVerifier} from "fhevm/lib/KMSVerifier.sol";
    import {TFHEExecutor} from "fhevm/lib/TFHEExecutor.sol";
    import {GatewayContract} from "fhevm/gateway/GatewayContract.sol";
    import {GatewayCaller} from "fhevm/gateway/GatewayCaller.sol";
    \n`;

  try {
    const dir = getImportsDir(fhevmPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "imports.sol"), solidityTemplate, { encoding: "utf8", flag: "w" });
    return dir;
  } catch (err) {
    throw new HardhatFhevmError(`Failed to generate 'imports.sol' file: ${err}`);
  }
}

function _writeMockedPrecompileSync(dir: string) {
  // Write solidity file
  const solidityTemplate = `// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {MockedPrecompile} from "fhevm/lib/MockedPrecompile.sol";
\n`;

  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "imports.sol"), solidityTemplate, { encoding: "utf8", flag: "w" });
    return dir;
  } catch (err) {
    throw new HardhatFhevmError(`Failed to generate 'imports.sol' file: ${err}`);
  }
}

////////////////////////////////////////////////////////////////////////////////
// Deploy
////////////////////////////////////////////////////////////////////////////////

async function _deployACL(
  contractsRootDir: string,
  config: ZamaDevConfig,
  provider: EthersT.Provider,
  hre: HardhatRuntimeEnvironment,
  logOptions: LogOptions,
): Promise<string> {
  const tfhe_executor_addr = _readZamaContractAddressFromEnvFileSync("TFHEExecutor", contractsRootDir, config);
  const addr = await _deployZamaContract(
    "ACL",
    [tfhe_executor_addr],
    contractsRootDir,
    config,
    provider,
    hre,
    logOptions,
  );
  return addr;
}

async function _deployTFHEExecutor(
  contractsRootDir: string,
  config: ZamaDevConfig,
  provider: EthersT.Provider,
  hre: HardhatRuntimeEnvironment,
  logOptions: LogOptions,
): Promise<string> {
  const addr = await _deployZamaContract("TFHEExecutor", [], contractsRootDir, config, provider, hre, logOptions);
  return addr;
}

async function _deployKMSVerifier(
  contractsRootDir: string,
  config: ZamaDevConfig,
  provider: EthersT.Provider,
  hre: HardhatRuntimeEnvironment,
  logOptions: LogOptions,
): Promise<string> {
  const addr = await _deployZamaContract("KMSVerifier", [], contractsRootDir, config, provider, hre, logOptions);
  return addr;
}

async function _deployGatewayContract(
  contractsRootDir: string,
  gatewayRelayerWalletAddress: string,
  config: ZamaDevConfig,
  provider: EthersT.Provider,
  hre: HardhatRuntimeEnvironment,
  logOptions: LogOptions,
) {
  const c = config.contracts["GatewayContract"];
  assert(c.owner);
  const ownerWallet = walletFromMnemonic(c.owner, config.deployer.mnemonic, config.deployer.path, provider);

  const kms_verifier_addr = _readZamaContractAddressFromEnvFileSync("KMSVerifier", contractsRootDir, config);
  if (!kms_verifier_addr) {
    throw new HardhatFhevmError(`Unable to deploy GatewayContract, missing KMSVerifier address`);
  }

  // deploy Gateway contract
  const addr = await _deployZamaContract(
    "GatewayContract",
    [ownerWallet.address, kms_verifier_addr],
    contractsRootDir,
    config,
    provider,
    hre,
    logOptions,
  );

  // add Gateway relayer
  await _addRelayer(addr, ownerWallet, gatewayRelayerWalletAddress, config, provider, hre, logOptions);

  return addr;
}

//hre needed
async function _addRelayer(
  gatewayContractAddress: string,
  owner: EthersT.HDNodeWallet,
  relayerWalletAddress: string,
  config: ZamaDevConfig,
  provider: EthersT.Provider,
  hre: HardhatRuntimeEnvironment,
  logOptions: LogOptions,
) {
  if (!(await isDeployed(gatewayContractAddress, provider))) {
    throw new HardhatFhevmError(`${gatewayContractAddress} is not a smart contract`);
  }

  const factory = await _getZamaContractFactory("GatewayContract", config, provider, hre);
  const gatewayContract = factory.attach(gatewayContractAddress).connect(owner) as EthersT.Contract;

  const _relayerAddress = EthersT.getAddress(relayerWalletAddress);

  const is_relayer = await gatewayContract.isRelayer(_relayerAddress);
  if (is_relayer) {
    logDim(`Account ${_relayerAddress} is already a gateway relayer`, logOptions);
    return;
  }

  /* eslint-disable @typescript-eslint/ban-ts-comment */
  //@ts-ignore
  const tx = await gatewayContract.addRelayer(_relayerAddress);
  const receipt = await tx.wait();
  if (receipt!.status === 1) {
    logDim(`Account ${_relayerAddress} was succesfully added as a gateway relayer`, logOptions);
  } else {
    throw new HardhatFhevmError("Add gateway relayer failed.");
  }
}

// hre needed
async function _deployZamaContract(
  contractName: ZamaContractName,
  /* eslint-disable  @typescript-eslint/no-explicit-any */
  args: any[],
  contractsRootDir: string,
  config: ZamaDevConfig,
  provider: EthersT.Provider,
  hre: HardhatRuntimeEnvironment,
  logOptions: LogOptions,
): Promise<string> {
  const deployer = _getDeployerWallet(contractName, config, provider);

  let address;
  let expectedAddr;
  let computedAddr;
  try {
    expectedAddr = _readZamaContractAddressFromEnvFileSync(contractName, contractsRootDir, config);
    computedAddr = _computeZamaContractAddress(contractName, config);
    if (!expectedAddr) {
      throw new Error("unable to read env address.");
    }
    if (expectedAddr !== computedAddr) {
      throw new Error("env address and computed address differ.");
    }
    if (await isDeployed(expectedAddr, provider)) {
      logDim(
        `${contractName.padEnd(15, " ")} is already deployed at ${expectedAddr} (deployer=${deployer.address})`,
        logOptions,
      );
      return expectedAddr;
    }

    const factory = await _getZamaContractFactory(contractName, config, provider, hre);
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

  logDim(`${contractName.padEnd(15, " ")} deployed at ${address} (deployer=${deployer.address})`, logOptions);

  return address;
}

async function _areZamaContractsDeployed(
  contractsRootDir: string,
  config: ZamaDevConfig,
  provider: EthersT.Provider,
  hre: HardhatRuntimeEnvironment,
  logOptions: LogOptions,
): Promise<boolean> {
  // Extra contracts are not tested.
  for (let i = 0; i < AllReleasedZamaContractNames.length; ++i) {
    const info = _getZamaContractBuildInfos(AllReleasedZamaContractNames[i], contractsRootDir, config, hre);
    const codeAtAddress = await provider.getCode(info.nextAddress);
    if (codeAtAddress === "0x") {
      logDim(`${AllReleasedZamaContractNames[i]} is not properly deployed.`, logOptions);
      return false;
    }
  }
  return true;
}

////////////////////////////////////////////////////////////////////////////////
// GatewayFirstRequestBugAvoider
////////////////////////////////////////////////////////////////////////////////

export async function ____deployAndRunGatewayFirstRequestBugAvoider(
  config: ZamaDevConfig,
  hre: HardhatRuntimeEnvironment,
  provider: EthersT.Provider | null,
) {
  const deployer = walletFromMnemonic(
    config.deployer.fhevmDeployer,
    config.deployer.mnemonic,
    config.deployer.path,
    provider,
  );

  const contract = await deployContract("GatewayFirstRequestBugAvoider", [], deployer, hre);

  const address = await contract.getAddress();
  const expectedAddr = hre.ethers.getCreateAddress({
    from: deployer.address,
    nonce: config.deployer.fhevmDeployerNextNonce,
  });

  if (address !== expectedAddr) {
    throw new HardhatFhevmError("Unexpected GatewayFirstRequestBugAvoider contract address (wrong nonce ??)");
  }

  /* eslint-disable @typescript-eslint/ban-ts-comment */
  //@ts-ignore
  const tx = await contract.connect(deployer).requestUint8({ gasLimit: 5_000_000 });
  await tx.wait(1);
}

export function ____writeGatewayFirstRequestBugAvoider(fhevmPath: string) {
  const solidityTemplate = `// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import {TFHE, euint8} from "fhevm/lib/TFHE.sol";
import {GatewayCaller} from "fhevm/gateway/GatewayCaller.sol";
import {Gateway} from "fhevm/gateway/lib/Gateway.sol";

contract GatewayFirstRequestBugAvoider is GatewayCaller {
    euint8 xUint8;

    uint8 public yUint8;

    uint256 public latestRequestID;

    constructor() {
        xUint8 = TFHE.asEuint8(42);
        TFHE.allow(xUint8, address(this));
    }

    function requestUint8() public {
        uint256[] memory cts = new uint256[](1);
        cts[0] = Gateway.toUint256(xUint8);
        Gateway.requestDecryption(cts, this.callbackUint8.selector, 0, block.timestamp + 100, false);
    }

    function callbackUint8(uint256, uint8 decryptedInput) public onlyGateway returns (uint8) {
        yUint8 = decryptedInput;
        return decryptedInput;
    }
}\n`;

  try {
    const dir = getPrecompileDir(fhevmPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "GatewayFirstRequestBugAvoider.sol"), solidityTemplate, {
      encoding: "utf8",
      flag: "w",
    });
    return dir;
  } catch (err) {
    throw new HardhatFhevmError(`Failed to generate 'GatewayFirstRequestBugAvoider.sol' file: ${err}`);
  }
}

////////////////////////////////////////////////////////////////////////////////
// Exported API
////////////////////////////////////////////////////////////////////////////////

export async function zamaPrepareCompilationIfNeeded(
  useOnChainFhevmMockProcessor: boolean,
  contractsRootDir: string,
  paths: ProjectPathsConfig,
  config: ZamaDevConfig,
  logOptions: LogOptions,
) {
  const ifNeeded = true;
  _writeAllZamaContractsSync(ifNeeded, contractsRootDir, config, logOptions);

  if (useOnChainFhevmMockProcessor) {
    _writeOverridesSolFile(paths);
  } else {
    _restoreOverridedSolFile(paths);
  }

  const dir = _writeImportSolFile(paths.fhevm);
  return dir;
}

export function zamaCleanOrBuildNeeded(
  contractsRootDir: string,
  config: ZamaDevConfig,
  hre: HardhatRuntimeEnvironment,
): { clean: boolean; build: boolean } {
  const res = {
    clean: false,
    build: false,
  };
  for (let i = 0; i < AllReleasedZamaContractNames.length; ++i) {
    const info = _getZamaContractBuildInfos(AllReleasedZamaContractNames[i], contractsRootDir, config, hre);
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

export async function zamaDeploy(
  contractsRootDir: string,
  gatewayRelayerWalletAddress: string,
  config: ZamaDevConfig,
  provider: EthersT.Provider,
  hre: HardhatRuntimeEnvironment,
  logOptions: LogOptions,
) {
  logTrace("deploy fhevm contracts", hre.fhevm.logOptions);

  const ACL = await _deployACL(contractsRootDir, config, provider, hre, logOptions);
  const TFHEExecutor = await _deployTFHEExecutor(contractsRootDir, config, provider, hre, logOptions);
  const KMSVerifier = await _deployKMSVerifier(contractsRootDir, config, provider, hre, logOptions);
  const GatewayContract = await _deployGatewayContract(
    contractsRootDir,
    gatewayRelayerWalletAddress,
    config,
    provider,
    hre,
    logOptions,
  );

  return {
    ACL,
    TFHEExecutor,
    KMSVerifier,
    GatewayContract,
  };
}

export function zamaReadContractAddressSync(
  contractName: ZamaContractName,
  contractsRootDir: string,
  config: ZamaDevConfig,
): string | undefined {
  return _readZamaContractAddressFromEnvFileSync(contractName, contractsRootDir, config);
}

export function zamaComputeContractAddresses(config: ZamaDevConfig): Record<ZamaContractName, string> {
  return {
    ACL: _computeZamaContractAddress("ACL", config),
    KMSVerifier: _computeZamaContractAddress("KMSVerifier", config),
    GatewayContract: _computeZamaContractAddress("GatewayContract", config),
    FHEPayment: _computeZamaContractAddress("FHEPayment", config),
    TFHEExecutor: _computeZamaContractAddress("TFHEExecutor", config),
  };
}

export function zamaAdminUserAddresses(config: ZamaDevConfig): Array<string> {
  const entries = Object.entries(config.contracts);
  const indices: Array<number> = [];
  for (let i = 0; i < entries.length; ++i) {
    const [, c]: [string, ZamaDevContractConfig] = entries[i];
    if (!indices.includes(c.deployer)) {
      indices.push(c.deployer);
    }
    if (c.owner && !indices.includes(c.owner)) {
      indices.push(c.owner);
    }
  }
  return indices.map((i) => walletFromMnemonic(i, config.deployer.mnemonic, config.deployer.path, null).address);
}

export function zamaArtifactSync(
  contractName: ZamaContractName,
  config: ZamaDevConfig,
  hre: HardhatRuntimeEnvironment,
) {
  return _readZamaContractArtifactSync(contractName, config, hre);
}

export function zamaWriteMockPrecompileSync(fhevmPath: string) {
  const precompile_dir = getPrecompileDir(fhevmPath);
  const dir = _writeMockedPrecompileSync(precompile_dir);
  return dir;
}

export async function zamaAreContractsDeployed(
  contractsRootDir: string,
  config: ZamaDevConfig,
  provider: EthersT.Provider,
  hre: HardhatRuntimeEnvironment,
  logOptions: LogOptions,
): Promise<boolean> {
  const ok = await _areZamaContractsDeployed(contractsRootDir, config, provider, hre, logOptions);
  return ok;
}

export async function zamaGetContrat(
  contractName: ZamaContractName,
  contractsRootDir: string,
  config: ZamaDevConfig,
  provider: EthersT.Provider,
  hre: HardhatRuntimeEnvironment,
) {
  const factory = await _getZamaContractFactory(contractName, config, provider, hre);
  const address = _readZamaContractAddressFromEnvFileSync(contractName, contractsRootDir, config);
  if (!address) {
    throw new HardhatFhevmError(`Unable to retreive ${contractName} contract artifact`);
  }
  return factory.attach(address);
}

export function getUserPackageNodeModulesDir(hhConfig: HardhatConfig): string {
  // must be absolute
  const p = path.join(hhConfig.paths.root, "node_modules");
  assert(p === hhConfig.paths.fhevmContracts);
  return hhConfig.paths.fhevmContracts;
}
