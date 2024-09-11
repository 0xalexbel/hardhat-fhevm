import { extendConfig, extendEnvironment, extendProvider, scope, subtask, task, types } from "hardhat/config";
import { lazyObject } from "hardhat/plugins";
import {
  EIP1193Provider,
  HardhatConfig,
  HardhatNetworkAccountsConfig,
  HardhatRuntimeEnvironment,
  HardhatUserConfig,
  TaskArguments,
} from "hardhat/types";
import path from "path";
import fs from "fs";
import {
  TASK_CLEAN,
  TASK_COMPILE,
  TASK_TEST,
  TASK_TEST_SETUP_TEST_ENVIRONMENT,
} from "hardhat/builtin-tasks/task-names";

import {
  TASK_FHEVM_START,
  TASK_FHEVM_STOP,
  TASK_FHEVM_REMOVE_KEYS,
  TASK_FHEVM_CREATE_KEYS,
  TASK_FHEVM_ACCOUNTS_SET_BALANCE,
  TASK_FHEVM_ACCOUNTS,
  TASK_FHEVM_DOCKER_UP,
  TASK_FHEVM_DOCKER_DOWN,
  TASK_FHEVM_WRITE_CONTRACT,
  TASK_FHEVM_VERIFY_CONTRACTS,
  TASK_FHEVM_COMPILE,
  TASK_FHEVM_DEPLOY,
  TASK_FHEVM_DEPLOY_ACL_CONTRACT,
  TASK_FHEVM_DEPLOY_TFHE_EXECUTOR_CONTRACT,
  TASK_FHEVM_DEPLOY_KMS_VERIFIER_CONTRACT,
  TASK_FHEVM_DEPLOY_GATEWAY_CONTRACT,
  TASK_FHEVM_GATEWAY_ADD_RELAYER,
  TASK_FHEVM_COMPILE_DIR,
  TASK_FHEVM_DEPLOY_MOCK_PRECOMPILE,
  TASK_FHEVM_START_MOCK,
  TASK_FHEVM_COMPUTE_CONTRACT_ADDRESS,
  TASK_FHEVM_CLEAN_IF_NEEDED,
  TASK_FHEVM_WRITE_ALL_CONTRACTS,
  TASK_FHEVM_DEPLOY_EXTRA,
} from "./internal-task-names";

import {
  SCOPE_FHEVM,
  SCOPE_FHEVM_TASK_START,
  SCOPE_FHEVM_TASK_STOP,
  SCOPE_FHEVM_TASK_RESTART,
  SCOPE_FHEVM_TASK_CLEAN,
  TASK_FHEVM_SETUP,
} from "./task-names";

import { logTrace, HardhatFhevmError, logBox, logDim, logDimWithGreenPrefix, LogOptions } from "./common/error";
import { MockFhevmRuntimeEnvironment } from "./mock/MockFhevmRuntimeEnvironment";
import { LocalFhevmRuntimeEnvironment } from "./local/LocalFhevmRuntimeEnvironment";
import "./type-extensions";
import rimraf from "rimraf";
import { runCmd, runDocker } from "./run";
import { ethers } from "ethers";
import {
  cleanOrBuildNeeded,
  computeContractAddress,
  deployFhevmContract,
  EXT_TFHE_LIBRARY,
  FhevmContractName,
  getACLOwnerSigner,
  getFhevmContractOwnerSigner,
  getUserPackageNodeModulesDir,
  getGatewayContract,
  getGatewayDeployerWallet,
  getGatewayOwnerWallet,
  getKMSVerifierOwnerSigner,
  getTFHEExecutorOwnerSigner,
  getWalletAddressAt,
  readGatewayContractAddress,
  readKMSVerifierAddress,
  readTFHEExecutorAddress,
  toFhevmContractName,
  writeContractAddress,
  writeImportSolFile,
  getFhevmContractAddressInfo,
  writeLibGateway,
  ____deployAndRunGatewayFirstRequestBugAvoider,
  ____writeGatewayFirstRequestBugAvoider,
  writeMockedPrecompile,
  areFhevmContractsDeployed,
} from "./common/contracts";
import assert from "assert";
import {
  HardhatFhevmRuntimeEnvironment,
  FhevmRuntimeEnvironmentType,
  FhevmRuntimeLogOptions,
} from "./common/HardhatFhevmRuntimeEnvironment";
import {
  getInstallKeysDir,
  getInstallPrivKeyFile,
  getInstallPrivKeysDir,
  getInstallPubKeyFile,
  getInstallPubKeysDir,
  getInstallServerKeyFile,
  getTmpDir,
  keysInstallNeeded,
} from "./common/dirs";
import { FhevmProvider } from "./provider";
import { LOCAL_FHEVM_NETWORK_NAME, HARDHAT_FHEVM_DEFAULT_MNEMONIC, DEFAULT_FHEVM_NETWORK_CONFIG } from "./constants";
import { isDeployed, sleep } from "./common/utils";

////////////////////////////////////////////////////////////////////////////////
// Exports
////////////////////////////////////////////////////////////////////////////////

export { HARDHAT_FHEVM_DEFAULT_MNEMONIC } from "./constants";
export * from "./types";
export { HardhatFhevmInstance } from "./common/HardhatFhevmRuntimeEnvironment";

////////////////////////////////////////////////////////////////////////////////

extendConfig((config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
  const userFhevmPath = userConfig.paths?.fhevm;
  const userHHMock = userConfig.networks?.hardhat?.mockFhevm;

  let fhevmPath: string;

  if (userFhevmPath === undefined) {
    fhevmPath = path.join(config.paths.root, "hh_fhevm");
  } else {
    if (path.isAbsolute(userFhevmPath)) {
      fhevmPath = userFhevmPath;
    } else {
      fhevmPath = path.normalize(path.join(config.paths.root, userFhevmPath));
    }
  }

  const contractsAbsolutePath = path.join(config.paths.root, "node_modules");

  const hhMock: boolean = !(userHHMock === false);

  let mnemonic: string = HARDHAT_FHEVM_DEFAULT_MNEMONIC;

  const hh_accounts: HardhatNetworkAccountsConfig = config.networks.hardhat.accounts;
  if ("mnemonic" in hh_accounts) {
    // HardhatNetworkHDAccountsConfig
    mnemonic = hh_accounts.mnemonic;
  } else {
    if (hhMock) {
      throw new HardhatFhevmError("hardhat-fhevm only supports HDAccounts when running with the hardhat network");
    }
  }

  config.paths.fhevm = fhevmPath;
  config.paths.fhevmContracts = contractsAbsolutePath;
  config.networks.fhevm = {
    ...DEFAULT_FHEVM_NETWORK_CONFIG,
    httpHeaders: { ...DEFAULT_FHEVM_NETWORK_CONFIG.httpHeaders },
    accounts: { ...DEFAULT_FHEVM_NETWORK_CONFIG.accounts, mnemonic },
  };
  config.networks.hardhat.mockFhevm = hhMock;
});

////////////////////////////////////////////////////////////////////////////////

extendEnvironment((hre) => {
  hre.fhevm = lazyObject(() => {
    if (HardhatFhevmRuntimeEnvironment.mockRequested(hre)) {
      return new MockFhevmRuntimeEnvironment(hre);
    } else if (HardhatFhevmRuntimeEnvironment.localRequested(hre)) {
      return new LocalFhevmRuntimeEnvironment(hre);
    } else {
      if (hre.network.name === "hardhat") {
        throw new HardhatFhevmError(
          "Looks like 'hardhat-fhevm' has been disabled in the hardhat config. Set the 'config.networks.hardhat.mockFhevm' property to 'true' to enable fhevm on the 'hardhat' network.",
        );
      } else {
        throw new HardhatFhevmError(
          `You are interacting with the hardhat-fhevm's custom field named 'fhevm' in the Hardhat Runtime Environment, but the network named '${hre.network.name}' does not support Fhevm. Only the 'hardhat' and the 'fhevm' networks support fhevm.`,
        );
      }
    }
  });
});

////////////////////////////////////////////////////////////////////////////////

extendProvider(async (provider: EIP1193Provider, config: HardhatConfig, network: string) => {
  return new FhevmProvider(provider, config, network);
});

////////////////////////////////////////////////////////////////////////////////

async function setBalance(address: string, amount: string, hre: HardhatRuntimeEnvironment) {
  const containerName = hre.fhevm.dockerServices().validatorContainerName();

  let ok = false;
  while (!ok) {
    //use FAUCET_AMOUNT env var to specify the amout
    const stdout = await runCmd(
      `docker exec -e FAUCET_AMOUNT=${amount} -i ${containerName} faucet ${address} | grep height`,
    );
    const res = JSON.parse(stdout);
    if (!res.raw_log.match("account sequence mismatch")) {
      ok = true;
      break;
    }
    await sleep(200);
  }

  const maxRetry = 50;
  let i = 0;
  while (i < maxRetry) {
    const balance = await hre.fhevm.provider().getBalance(address);
    if (balance > 0) {
      logDim(`${address} balance=${balance}`, hre.fhevm.logOptions);
      return;
    }
    await sleep(1000);
    i++;
  }

  logDim(`${address} balance=???`, hre.fhevm.logOptions);
}

async function setMockBalance(
  address: string,
  amount: ethers.BytesLike | ethers.BigNumberish,
  hre: HardhatRuntimeEnvironment,
) {
  assert(hre.fhevm.isMock());
  assert(!hre.fhevm.isConfliting());
  await hre.network.provider.send("hardhat_setBalance", [address, ethers.toQuantity(amount)]);

  const balance = await hre.fhevm.provider().getBalance(address);
  logDim(`${address} balance=${balance}`, hre.fhevm.logOptions);
}

////////////////////////////////////////////////////////////////////////////////

subtask(TASK_FHEVM_REMOVE_KEYS, async (_taskArgs, hre) => {
  const keysDir = getInstallKeysDir(hre);
  try {
    await rimraf(keysDir);
  } catch {
    throw new HardhatFhevmError(`Unable to remove keys directory: ${keysDir}`);
  }
});

subtask(TASK_FHEVM_ACCOUNTS, async (_taskArgs, hre) => {
  const relayerWallet = hre.fhevm.gatewayRelayerWallet();
  const deployerWallet = getGatewayDeployerWallet(hre);
  const ownerWallet = getGatewayOwnerWallet(hre);

  const addresses = [];
  for (let i = 0; i < 5; ++i) {
    addresses.push(getWalletAddressAt(i, hre.config));
  }

  // Default = 9
  const ACLOwnerSigner = getACLOwnerSigner(hre);
  if (!addresses.includes(ACLOwnerSigner.address)) {
    addresses.push(ACLOwnerSigner.address);
  }
  // Default = 9
  const KMSOwnerSigner = getKMSVerifierOwnerSigner(hre);
  if (!addresses.includes(KMSOwnerSigner.address)) {
    addresses.push(KMSOwnerSigner.address);
  }
  // Default = 9
  const TFHEExecutorOwnerSigner = getTFHEExecutorOwnerSigner(hre);
  if (!addresses.includes(TFHEExecutorOwnerSigner.address)) {
    addresses.push(TFHEExecutorOwnerSigner.address);
  }
  if (!addresses.includes(relayerWallet.address)) {
    addresses.push(relayerWallet.address);
  }
  // Default = 4
  if (!addresses.includes(deployerWallet.address)) {
    addresses.push(deployerWallet.address);
  }
  // Default = 4
  if (!addresses.includes(ownerWallet.address)) {
    addresses.push(ownerWallet.address);
  }

  // Default len = 7
  return addresses;
});

subtask(TASK_FHEVM_ACCOUNTS_SET_BALANCE, async (_taskArgs, hre) => {
  logTrace("setup accounts balance", hre.fhevm.logOptions);
  const addresses: string[] = await hre.run(TASK_FHEVM_ACCOUNTS);
  assert(Array.isArray(addresses));

  const n = hre.config.networks.fhevm.accounts.count;
  for (let i = 0; i < n; ++i) {
    const a = getWalletAddressAt(i, hre.config);
    if (!addresses.includes(a)) {
      addresses.push(a);
    }
  }

  const promises = addresses.map((address: string) => {
    if (hre.fhevm.isLocal()) {
      return setBalance(address, hre.config.networks.fhevm.accounts.accountsBalance, hre);
    } else if (hre.fhevm.isMock()) {
      return setMockBalance(address, hre.config.networks.fhevm.accounts.accountsBalance, hre);
    } else {
      throw new HardhatFhevmError(`Invalid network '${hre.network.name}'`);
    }
  });
  await Promise.all(promises);
});

subtask(TASK_FHEVM_CREATE_KEYS, async (_taskArgs, hre) => {
  logTrace("setup fhevm keys", hre.fhevm.logOptions);
  const dockerImage = hre.fhevm.dockerServices().kmsCoreServiceDockerImage();

  let gatewayKmsKeyID;
  try {
    const gatewayEnvs = hre.fhevm.dockerServices().gatewayServiceEnvs();
    gatewayKmsKeyID = gatewayEnvs.GATEWAY__KMS__KEY_ID;
    assert(gatewayKmsKeyID === hre.config.networks.fhevm.accounts.GatewayKmsKeyID);
  } catch {
    throw new HardhatFhevmError(`Unable to retreive gateway kms key ID`);
  }

  const tmpDir = getTmpDir();
  const tmpKeysDir = path.join(tmpDir, "keys");

  try {
    fs.mkdirSync(tmpKeysDir, { recursive: true });
    const pubKeysDir = getInstallPubKeysDir(hre);
    const privKeysDir = getInstallPrivKeysDir(hre);

    runDocker(["pull", dockerImage], hre.fhevm.logOptions);
    runDocker(["create", "--name", "hhfhevm-temp-container", dockerImage], hre.fhevm.logOptions);
    runDocker(["cp", "hhfhevm-temp-container:/app/kms/core/service/keys", tmpDir], hre.fhevm.logOptions);
    runDocker(["rm", "hhfhevm-temp-container"], hre.fhevm.logOptions);

    fs.mkdirSync(privKeysDir, { recursive: true });
    fs.mkdirSync(pubKeysDir, { recursive: true });

    const sks = path.join(tmpKeysDir, "PUB/ServerKey", gatewayKmsKeyID);
    if (!fs.existsSync(sks)) {
      throw new HardhatFhevmError("Unable to retreive server key file");
    }
    const pks = path.join(tmpKeysDir, "PUB/PublicKey", gatewayKmsKeyID);
    if (!fs.existsSync(pks)) {
      throw new HardhatFhevmError("Unable to retreive public key file");
    }
    const cks = path.join(tmpKeysDir, "PRIV/FhePrivateKey", gatewayKmsKeyID);
    if (!fs.existsSync(cks)) {
      throw new HardhatFhevmError("Unable to retreive private key file");
    }

    logDim(`Copying server key  to ${pubKeysDir}/sks`, hre.fhevm.logOptions);
    fs.copyFileSync(sks, getInstallServerKeyFile(hre));

    logDim(`Copying public key  to ${pubKeysDir}/pks`, hre.fhevm.logOptions);
    fs.copyFileSync(pks, getInstallPubKeyFile(hre));

    logDim(`Copying private key to ${privKeysDir}/cks`, hre.fhevm.logOptions);
    fs.copyFileSync(cks, getInstallPrivKeyFile(hre));
  } finally {
    try {
      logDim(`rm -rf ${tmpDir}`, hre.fhevm.logOptions);
      rimraf(tmpDir);
    } catch {
      /* eslint-disable no-empty*/
    }
  }
});

subtask(TASK_FHEVM_DOCKER_UP, async (_taskArgs, hre) => {
  logTrace("start docker services", hre.fhevm.logOptions);
  await hre.fhevm.dockerServices().installFiles();
  // docker compose -f /path/to/docker-compose-full.yml up --detach
  runDocker(["compose", "-f", hre.fhevm.dockerServices().installDockerFile, "up", "--detach"], hre.fhevm.logOptions);
});

subtask(TASK_FHEVM_DOCKER_DOWN, async (_taskArgs, hre) => {
  logTrace("stop docker services", hre.fhevm.logOptions);
  await hre.fhevm.dockerServices().installFiles();
  //docker compose  -f /path/to/docker-compose-full.yml down
  runDocker(["compose", "-f", hre.fhevm.dockerServices().installDockerFile, "down"], hre.fhevm.logOptions);
});

subtask(TASK_FHEVM_VERIFY_CONTRACTS, async function (taskArgs, hre) {
  const validatorEnvs = hre.fhevm.dockerServices().validatorServiceEnvs();
  const tfhe_executor_addr = computeContractAddress("TFHEExecutor", undefined, hre);
  // console.log(tfhe_executor_addr);
  // console.log(validatorEnvs["TFHE_EXECUTOR_CONTRACT_ADDRESS"]);
  if (tfhe_executor_addr.toLowerCase() !== validatorEnvs["TFHE_EXECUTOR_CONTRACT_ADDRESS"].toLowerCase()) {
    throw new HardhatFhevmError("Incompatible TFHEExecutor contract addresses");
  }

  const gateway_addr = computeContractAddress("GatewayContract", undefined, hre);
  const gatewayEnvs = hre.fhevm.dockerServices().gatewayServiceEnvs();
  if (gateway_addr.toLowerCase() !== "0x" + gatewayEnvs["GATEWAY__ETHEREUM__ORACLE_PREDEPLOY_ADDRESS"].toLowerCase()) {
    throw new HardhatFhevmError("Incompatible Gateway contract addresses");
  }
});

subtask(TASK_FHEVM_COMPUTE_CONTRACT_ADDRESS)
  .addParam("contractName", undefined, undefined, types.string)
  .setAction(async function (taskArgs, hre) {
    const contractName = toFhevmContractName(taskArgs.contractName);
    return computeContractAddress(contractName, undefined, hre);
  });

subtask(TASK_FHEVM_WRITE_CONTRACT)
  .addParam("contractName", undefined, undefined, types.string)
  .addParam("force", undefined, undefined, types.boolean)
  .setAction(async function (taskArgs, hre) {
    const contractName = toFhevmContractName(taskArgs.contractName);

    let installNeeded = taskArgs.force as boolean;

    if (!installNeeded) {
      const { currentAddress, nextAddress } = getFhevmContractAddressInfo(contractName, hre);

      installNeeded =
        currentAddress.length === 0 ||
        (currentAddress !== nextAddress && currentAddress.length > 0 && nextAddress.length > 0);

      if (!installNeeded) {
        return {
          address: currentAddress,
          changed: false,
        };
      }
    }

    return writeContractAddress(contractName, undefined, hre);
  });

subtask(TASK_FHEVM_COMPILE_DIR)
  .addParam("dir", undefined, undefined, types.string)
  .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const dir = taskArgs.dir as string;
    const sources = hre.config.paths.sources;
    hre.config.paths.sources = dir;
    try {
      await hre.run(TASK_COMPILE, { quiet: true });
    } finally {
      hre.config.paths.sources = sources;
    }
  });

subtask(TASK_FHEVM_CLEAN_IF_NEEDED, async (_taskArgs, hre) => {
  const cleanOrBuild = cleanOrBuildNeeded(hre);
  if (cleanOrBuild.clean) {
    logTrace("rebuild needed!", hre.fhevm.logOptions);
    await hre.run(TASK_CLEAN);
  }
  return cleanOrBuild.clean;
});

subtask(TASK_FHEVM_WRITE_ALL_CONTRACTS)
  .addParam("force", undefined, undefined, types.boolean)
  .setAction(async (taskArgs, hre) => {
    const force = taskArgs.force as boolean;

    // Write ACL.sol
    const ACL_res = await hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "ACL", force });

    // Write TFHEExecutor.sol
    /* const TFHEExecutor_res = */ await hre.run(TASK_FHEVM_WRITE_CONTRACT, {
      contractName: "TFHEExecutor",
      force,
    });

    // Write KMSVerfier.sol
    const KMSVerifier_res = await hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "KMSVerifier", force });

    // Write GatewayContract.sol
    const GatewayContract_res = await hre.run(TASK_FHEVM_WRITE_CONTRACT, {
      contractName: "GatewayContract",
      force,
    });

    // Write Gateway.sol
    writeLibGateway(
      { ACL: ACL_res.address, GatewayContract: GatewayContract_res.address, KMSVerifier: KMSVerifier_res.address },
      hre,
    );
  });

subtask(TASK_FHEVM_COMPILE, async (_taskArgs, hre) => {
  logTrace("compile fhevm contracts", hre.fhevm.logOptions);

  await hre.run(TASK_FHEVM_WRITE_ALL_CONTRACTS, { force: !true });

  const dir = writeImportSolFile(hre);
  await hre.run(TASK_FHEVM_COMPILE_DIR, { dir });
});

subtask(TASK_FHEVM_DEPLOY_ACL_CONTRACT, async (_taskArgs, hre) => {
  const tfhe_executor_addr = readTFHEExecutorAddress(getUserPackageNodeModulesDir(hre.config));
  return await deployFhevmContract("ACL", [tfhe_executor_addr], hre);
});

subtask(TASK_FHEVM_DEPLOY_TFHE_EXECUTOR_CONTRACT, async (_taskArgs, hre) => {
  return await deployFhevmContract("TFHEExecutor", [], hre);
});

subtask(TASK_FHEVM_DEPLOY_KMS_VERIFIER_CONTRACT, async (_taskArgs, hre) => {
  return await deployFhevmContract("KMSVerifier", [], hre);
});

subtask(TASK_FHEVM_DEPLOY_GATEWAY_CONTRACT, async (_taskArgs, hre) => {
  const ownerWallet = getGatewayOwnerWallet(hre);
  const kms_verifier_addr = readKMSVerifierAddress(getUserPackageNodeModulesDir(hre.config));
  return await deployFhevmContract("GatewayContract", [ownerWallet.address, kms_verifier_addr], hre);
});

subtask(TASK_FHEVM_GATEWAY_ADD_RELAYER, async (_taskArgs, hre) => {
  const gatewayContractAddress = readGatewayContractAddress(getUserPackageNodeModulesDir(hre.config));
  const codeAtAddress = await hre.fhevm.provider().getCode(gatewayContractAddress);
  if (codeAtAddress === "0x") {
    throw new HardhatFhevmError(`${gatewayContractAddress} is not a smart contract`);
  }

  const gatewayOwnerWallet = getGatewayOwnerWallet(hre);
  const gatewayContract = (await getGatewayContract(hre)).connect(gatewayOwnerWallet);

  const relayerWalletAddress = hre.fhevm.gatewayRelayerWallet().address;
  /* eslint-disable @typescript-eslint/ban-ts-comment */
  //@ts-ignore
  const tx = await gatewayContract.addRelayer(relayerWalletAddress);
  const receipt = await tx.wait();
  if (receipt!.status === 1) {
    logDim(`Account ${relayerWalletAddress} was succesfully added as a gateway relayer`, hre.fhevm.logOptions);
  } else {
    throw new HardhatFhevmError("Add gateway relayer failed.");
  }
});

subtask(TASK_FHEVM_DEPLOY, async (_taskArgs, hre) => {
  logTrace("deploy fhevm contracts", hre.fhevm.logOptions);
  // Nonce == 0
  const ACL = await hre.run(TASK_FHEVM_DEPLOY_ACL_CONTRACT);
  // Nonce == 1
  const TFHEExecutor = await hre.run(TASK_FHEVM_DEPLOY_TFHE_EXECUTOR_CONTRACT);
  // Nonce == 2
  const KMSVerifier = await hre.run(TASK_FHEVM_DEPLOY_KMS_VERIFIER_CONTRACT);
  // Nonce == 0 (different deployer)
  const GatewayContract = await hre.run(TASK_FHEVM_DEPLOY_GATEWAY_CONTRACT);

  await hre.run(TASK_FHEVM_GATEWAY_ADD_RELAYER);

  return {
    ACL,
    TFHEExecutor,
    KMSVerifier,
    GatewayContract,
  };
});

////////////////////////////////////////////////////////////////////////////////
// Start/Stop Local
////////////////////////////////////////////////////////////////////////////////

/**
 * Return false if already running, true if not
 */
subtask(TASK_FHEVM_START, async (_taskArgs, hre) => {
  if (!(await hre.fhevm.dockerServices().isDockerRunning())) {
    logBox("Docker is not running (or is in resource saving mode). Please start docker first.", hre.fhevm.logOptions);
    throw new HardhatFhevmError("Docker is not running (or is in resource saving mode). Please start docker first.");
  }

  if (!hre.fhevm.isLocal()) {
    logBox(
      `Call 'npx hardhat --network ${LOCAL_FHEVM_NETWORK_NAME} ${SCOPE_FHEVM} ${SCOPE_FHEVM_TASK_START}' to start the local fhevm node`,
      hre.fhevm.logOptions,
    );
    throw new HardhatFhevmError(
      `Cannot start a fhevm local node on network '${hre.network.name}', use the '--network fhevm' instead or set 'defaultNetwork:"${LOCAL_FHEVM_NETWORK_NAME}"' in your hardhat config file.`,
    );
  }

  const cleanOrBuild = cleanOrBuildNeeded(hre);
  const keysNotInstalled = keysInstallNeeded(hre);

  let deployed = false;
  const fhevmIsRunning = await hre.fhevm.dockerServices().isFhevmRunning();
  if (fhevmIsRunning) {
    deployed = await areFhevmContractsDeployed(hre);
  }

  if (fhevmIsRunning && !cleanOrBuild.clean && !keysNotInstalled && deployed) {
    if (cleanOrBuild.build) {
      await hre.run(TASK_FHEVM_COMPILE);
    }

    return false;
  }

  if (fhevmIsRunning) {
    if (keysNotInstalled) {
      logTrace("Restart local fhevm node needed because keys are not installed.", hre.fhevm.logOptions);
    }
  }

  if (cleanOrBuild.clean) {
    logTrace("rebuild needed!", hre.fhevm.logOptions);
    await hre.run(TASK_CLEAN);
  }

  logBox("Starting local fhevm node... it might take some time.", hre.fhevm.logOptions);

  await hre.run(TASK_FHEVM_STOP);
  await hre.run(TASK_FHEVM_COMPILE);
  await hre.run(TASK_FHEVM_CREATE_KEYS);
  await hre.run(TASK_FHEVM_DOCKER_UP);
  await hre.run(TASK_FHEVM_ACCOUNTS_SET_BALANCE);

  const deployedContracts = await hre.run(TASK_FHEVM_DEPLOY);

  // Deploy any extra contract
  await hre.run(TASK_FHEVM_DEPLOY_EXTRA);

  logStartReport(deployedContracts, hre);

  if (cleanOrBuild.build) {
    logTrace("compile contracts", hre.fhevm.logOptions);
    await hre.run(TASK_COMPILE, { quiet: true });
  }

  return true;
});

subtask(TASK_FHEVM_STOP, async (_taskArgs, hre) => {
  await hre.run(TASK_FHEVM_DOCKER_DOWN);
  await hre.run(TASK_FHEVM_REMOVE_KEYS);
});

subtask(TASK_FHEVM_DEPLOY_EXTRA, async (_taskArgs, hre) => {
  logTrace("compile gateway bug fix...", hre.fhevm.logOptions);

  const dir = ____writeGatewayFirstRequestBugAvoider(hre);
  await hre.run(TASK_FHEVM_COMPILE_DIR, { dir });

  /**
   * First decryption request bug
   * ============================
   * the function '____deployAndRunGatewayFirstRequestBugAvoider' is temporary
   * should be removed when the gateway bug will be fixed
   */
  logTrace("deploy+run gateway bug fix...", hre.fhevm.logOptions);

  await ____deployAndRunGatewayFirstRequestBugAvoider(hre);
});

////////////////////////////////////////////////////////////////////////////////
// Start Mock
////////////////////////////////////////////////////////////////////////////////

subtask(TASK_FHEVM_START_MOCK, async (_taskArgs, hre) => {
  const orig_sources_path = hre.config.paths.sources;

  await hre.run(TASK_FHEVM_CLEAN_IF_NEEDED);
  await hre.run(TASK_FHEVM_DEPLOY_MOCK_PRECOMPILE);
  await hre.run(TASK_FHEVM_COMPILE);
  await hre.run(TASK_FHEVM_ACCOUNTS_SET_BALANCE);
  const deployedContracts = await hre.run(TASK_FHEVM_DEPLOY);

  logTrace("compile contracts", hre.fhevm.logOptions);
  // Make sure we are compiling the user contracts
  assert(hre.config.paths.sources === orig_sources_path);
  await hre.run(TASK_COMPILE, { quiet: true });

  logStartReport(deployedContracts, hre);
});

subtask(TASK_FHEVM_DEPLOY_MOCK_PRECOMPILE, async (_taskArgs, hre) => {
  logTrace("compile fhevm mock coprocessor contract", hre.fhevm.logOptions);

  // Compile MockedPrecompile.sol
  const dir = writeMockedPrecompile(hre);
  await hre.run(TASK_FHEVM_COMPILE_DIR, { dir });

  // Deploy MockedPrecompile.sol
  const targetAddress = EXT_TFHE_LIBRARY;
  const NeverRevert = await hre.artifacts.readArtifact("MockedPrecompile");
  const bytecode = NeverRevert.deployedBytecode;
  await hre.network.provider.send("hardhat_setCode", [targetAddress, bytecode]);

  logDim(`Code of Mocked Pre-compile set at address: ${targetAddress}`, hre.fhevm.logOptions);
});

function logStartReport(deployedContracts: Record<string, string>, hre: HardhatRuntimeEnvironment) {
  if (hre.fhevm.logOptions.quiet) {
    return;
  }

  const accounts = hre.config.networks.fhevm.accounts;
  const col = 25;

  const lo: LogOptions = hre.fhevm.logOptions;

  const v: FhevmContractName[] = ["ACL", "TFHEExecutor", "KMSVerifier", "GatewayContract"];
  v.forEach((name: FhevmContractName) => {
    const colName = `${name} owner:`.padEnd(col, " ");
    const colAddr = getFhevmContractOwnerSigner(name, hre).address;
    logDimWithGreenPrefix(colName, colAddr, lo);
  });

  logDimWithGreenPrefix(
    "GatewayContract deployer:",
    `${getGatewayDeployerWallet(hre).address} (index=${accounts.GatewayContractDeployer}`,
    lo,
  );
  logDimWithGreenPrefix(
    "GatewayContract relayer: ",
    `${hre.fhevm.gatewayRelayerAddress()} (private key=${accounts.GatewayRelayerPrivateKey})`,
    lo,
  );

  v.forEach((name: FhevmContractName) => {
    const colName = `${name} address:`.padEnd(col, " ");
    const colAddr = deployedContracts[name];
    logDimWithGreenPrefix(colName, colAddr, lo);
  });
}

////////////////////////////////////////////////////////////////////////////////
// Scoped commands
// - npx hardhat fhevm start
// - npx hardhat fhevm stop
// - npx hardhat fhevm restart
// - npx hardhat fhevm clean
////////////////////////////////////////////////////////////////////////////////

const fhevmScope = scope(SCOPE_FHEVM, "Manage a fhevm node");

fhevmScope
  .task(SCOPE_FHEVM_TASK_START)
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: FhevmRuntimeLogOptions, hre) => {
    hre.fhevm.logOptions = { quiet, stderr };

    hre.fhevm.__enterForceLocal();

    // returns true if started, false if already running
    const started = await hre.run(TASK_FHEVM_START);

    hre.fhevm.__exitForceLocal();

    if (!started) {
      logTrace("fhevm already running.", hre.fhevm.logOptions);
    }
  });

fhevmScope
  .task(SCOPE_FHEVM_TASK_STOP)
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: FhevmRuntimeLogOptions, hre) => {
    hre.fhevm.logOptions = { quiet, stderr };

    hre.fhevm.__enterForceLocal();

    await hre.run(TASK_FHEVM_STOP);

    hre.fhevm.__exitForceLocal();
  });

fhevmScope
  .task(SCOPE_FHEVM_TASK_RESTART)
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: FhevmRuntimeLogOptions, hre) => {
    hre.fhevm.__enterForceLocal();

    await hre.run(TASK_FHEVM_STOP, { quiet, stderr });
    await hre.run(TASK_FHEVM_START, { quiet, stderr });

    hre.fhevm.__exitForceLocal();
  });

fhevmScope
  .task(SCOPE_FHEVM_TASK_CLEAN)
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: FhevmRuntimeLogOptions, hre) => {
    await hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_STOP }, { quiet, stderr });
    logTrace(`remove directory: ${hre.config.paths.fhevm}`, hre.fhevm.logOptions);
    await rimraf(hre.config.paths.fhevm);
  });

////////////////////////////////////////////////////////////////////////////////
// Compile
////////////////////////////////////////////////////////////////////////////////

task(TASK_COMPILE, async (_taskArgs, hre, runSuper) => {
  if (HardhatFhevmRuntimeEnvironment.isUserRequested(hre)) {
    await hre.run(TASK_FHEVM_WRITE_ALL_CONTRACTS, { force: false });
  }

  // No init needed at this point

  return runSuper();
});

////////////////////////////////////////////////////////////////////////////////
// Test
////////////////////////////////////////////////////////////////////////////////

subtask(TASK_TEST_SETUP_TEST_ENVIRONMENT, async (_taskArgs, _hre, runSuper) => {
  return runSuper();
});

task(TASK_TEST, async (_taskArgs, hre, runSuper) => {
  await hre.run(TASK_FHEVM_SETUP, { quiet: false, stderr: false });
  return runSuper();
});

subtask(TASK_FHEVM_SETUP)
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: FhevmRuntimeLogOptions, hre) => {
    if (hre.fhevm.initialized) {
      return;
    }
    if (!HardhatFhevmRuntimeEnvironment.isUserRequested(hre)) {
      return;
    }

    hre.fhevm.logOptions = { quiet, stderr };

    if (!(await isDeployed(hre.ethers.provider, hre.fhevm.ACLAddress()))) {
      if (hre.fhevm.runtimeType() === FhevmRuntimeEnvironmentType.Mock) {
        await hre.run(TASK_FHEVM_START_MOCK);
      } else {
        await hre.run(TASK_FHEVM_START);
      }
    }

    // Initialize fhevm runtime
    await hre.fhevm.init();
  });
