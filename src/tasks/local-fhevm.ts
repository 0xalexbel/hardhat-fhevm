import assert from "assert";
import { scope, subtask } from "hardhat/config";
import {
  SCOPE_FHEVM_LOCAL,
  SCOPE_FHEVM_LOCAL_TASK_RESTART,
  SCOPE_FHEVM_LOCAL_TASK_START,
  SCOPE_FHEVM_LOCAL_TASK_STOP,
  SCOPE_FHEVM_TASK_CLEAN,
} from "../task-names";
import { HardhatFhevmRuntimeLogOptions } from "../types";
import { fhevmContext } from "../internal/EnvironmentExtender";
import { FhevmProviderType } from "../internal/FhevmProviderType";
import { LocalFhevmProvider } from "../internal/providers/local/LocalFhevmProvider";
import { DockerServices } from "../internal/DockerServices";
import rimraf from "rimraf";
import { DockerServicesReader } from "../internal/DockerServicesReader";
import { getUserAddresses } from "../internal/utils/config_utils";
import { TASK_FHEVM_START_LOCAL } from "../internal-task-names";
import { HardhatFhevmError } from "../error";

const fhevmLocalScope = scope(SCOPE_FHEVM_LOCAL, "Manage a local fhevm server");

async function _getDockerServices(): Promise<DockerServices> {
  const fhevmEnv = fhevmContext.get();

  assert(fhevmEnv.provider !== undefined);
  assert((await fhevmEnv.getFhevmProvider()).providerType === FhevmProviderType.Local);

  const fhevmProvider = await fhevmEnv.getFhevmProvider();
  assert(fhevmProvider.providerType === FhevmProviderType.Local);
  assert(fhevmProvider instanceof LocalFhevmProvider);

  return (fhevmProvider as LocalFhevmProvider).dockerServices;
}

/* eslint-disable no-empty-pattern */
subtask(TASK_FHEVM_START_LOCAL).setAction(async ({}, hre) => {
  const fhevmEnv = fhevmContext.get();

  const isLocal = await fhevmEnv.isLocal();
  if (!isLocal) {
    throw new HardhatFhevmError(`Network '${fhevmEnv.networkName}' is not a local fhevm node.`);
  }

  if (!(await DockerServices.isDockerRunning())) {
    fhevmEnv.logBox("Docker is not running (or is in resource saving mode). Please start docker first.");
    throw new HardhatFhevmError("Docker is not running (or is in resource saving mode). Please start docker first.");
  }

  const dockerServices = await _getDockerServices();
  assert(dockerServices.initialized);

  let fhevmIsRunning = await dockerServices.isFhevmRunning();
  if (fhevmIsRunning) {
    const cleanOrBuildNeeded = await fhevmEnv.cleanOrBuildNeeded();

    let check: { restartNeeded: boolean; reason?: string } = { restartNeeded: false, reason: undefined };

    // No clean needed ? maybe the docker services need to restart ?
    if (!cleanOrBuildNeeded.clean) {
      // check docker files and keys
      const reader = new DockerServicesReader(dockerServices.rootDirectory);
      check = reader.isRestartNeeded(dockerServices.config);
    } else {
      check = {
        restartNeeded: true,
        reason: "hardhat clean needed (addresses have changed)",
      };
    }

    if (check.restartNeeded) {
      fhevmEnv.logBox("Restarting local fhevm node... it might take some time.");
      if (check.reason) {
        fhevmEnv.logTrace(`Restart reason : ${check.reason}`);
      }

      await dockerServices.down();

      fhevmIsRunning = false;
    }
  } else {
    // Down needed because the services may be partially running
    fhevmEnv.logBox("Starting local fhevm node... it might take some time.");

    await dockerServices.down();
  }

  let fhevmContractsDeployed = false;
  if (!fhevmIsRunning) {
    await dockerServices.up();
  } else {
    // The server is running fine, are the contracts deployed ?
    fhevmContractsDeployed = await fhevmEnv.areFhevmContractsDeployed();
  }

  if (fhevmContractsDeployed) {
    // TODO: Check balances
    // if the docker services is up and running and the contracts are deployed
    // Fine! nothing to do!
    fhevmEnv.logTrace(`Local fhevm node is already running.`);
  } else {
    await fhevmEnv.runSetup();

    const userAddresses = getUserAddresses(hre.config.fhevmNode.accounts);

    // Setup user balances with the 'accountsBalance' specified in the 'hardhat.config' + fhevmNode settings
    await fhevmEnv.setBalances(userAddresses, hre.config.fhevmNode.accounts.accountsBalance);
  }
});

fhevmLocalScope
  .task(SCOPE_FHEVM_LOCAL_TASK_START)
  .setDescription("Starts a local fhevm node")
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: HardhatFhevmRuntimeLogOptions, hre) => {
    const fhevmEnv = fhevmContext.get();

    fhevmEnv.logOptions = { quiet, stderr };

    const old = await fhevmEnv.setLocalUserDeployOptions();

    try {
      const res = await hre.run(TASK_FHEVM_START_LOCAL);
      return res;
    } finally {
      fhevmEnv.setUserDeployOptions(old);
    }
  });

fhevmLocalScope
  .task(SCOPE_FHEVM_LOCAL_TASK_STOP)
  .setDescription("Stops any running local fhevm node")
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: HardhatFhevmRuntimeLogOptions) => {
    const fhevmEnv = fhevmContext.get();

    fhevmEnv.logOptions = { quiet, stderr };

    if (!(await DockerServices.isDockerRunning())) {
      fhevmEnv.logBox("Docker is not running (or is in resource saving mode). Please start docker first.");
      throw new HardhatFhevmError("Docker is not running (or is in resource saving mode). Please start docker first.");
    }

    const old = await fhevmEnv.setLocalUserDeployOptions();

    const dockerServices = await _getDockerServices();
    await dockerServices.down();

    fhevmEnv.setUserDeployOptions(old);
  });

fhevmLocalScope
  .task(SCOPE_FHEVM_LOCAL_TASK_RESTART)
  .setDescription("Restarts a local fhevm node.")
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: HardhatFhevmRuntimeLogOptions, hre) => {
    const fhevmEnv = fhevmContext.get();

    fhevmEnv.logOptions = { quiet, stderr };

    await hre.run({ scope: SCOPE_FHEVM_LOCAL, task: SCOPE_FHEVM_LOCAL_TASK_STOP });
    await hre.run({ scope: SCOPE_FHEVM_LOCAL, task: SCOPE_FHEVM_LOCAL_TASK_START });
  });

fhevmLocalScope
  .task(SCOPE_FHEVM_TASK_CLEAN)
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: HardhatFhevmRuntimeLogOptions) => {
    const fhevmEnv = fhevmContext.get();

    fhevmEnv.logOptions = { quiet, stderr };

    const old = await fhevmEnv.setLocalUserDeployOptions();

    const dockerServices = await _getDockerServices();
    await dockerServices.down();
    await rimraf(fhevmEnv.paths.localFhevmNodeCache);

    fhevmEnv.setUserDeployOptions(old);
  });
