import {
  TASK_COMPILE,
  TASK_COMPILE_GET_REMAPPINGS,
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
  TASK_TEST,
} from "hardhat/builtin-tasks/task-names";
import { subtask, task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { fhevmContext } from "../internal/EnvironmentExtender";
import { TASK_FHEVM_START_LOCAL } from "../internal-task-names";
import { HardhatFhevmError } from "../error";

subtask(TASK_COMPILE_GET_REMAPPINGS).setAction(async (taskArgs, hre, runSuper): Promise<Record<string, string>> => {
  const fhevmEnv = fhevmContext.get();

  // run super first.
  const res = (await runSuper()) as Record<string, string>;

  // apply our remapping
  const remappings = fhevmEnv.getRemappings();
  Object.entries(remappings).forEach(([k, v]) => {
    fhevmEnv.logDim(`remapping: ${k} => ${v}`);
    res[k] = v;
  });

  return res;
});

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async ({ sourcePath }: { sourcePath?: string }, hre, runSuper): Promise<string[]> => {
    const fhevmEnv = fhevmContext.get();

    // run super first.
    const filePaths: string[] = await runSuper();

    // append our solidity files.
    const fhevmSourcePaths = await fhevmEnv.getSoliditySourcePaths();
    for (let i = 0; i < fhevmSourcePaths.length; ++i) {
      filePaths.push(fhevmSourcePaths[i]);
    }

    return filePaths;
  },
);

/**
 * Typically `skipSolInstallDuringCompilation === false` when the user calls the compile task directly
 * via the CLI `npx hardhat compile`
 */
task(TASK_COMPILE, async (taskArgs: TaskArguments, hre, runSuper) => {
  const fhevmEnv = fhevmContext.get();

  if (!fhevmEnv.skipSolInstallDuringCompilation) {
    await fhevmEnv.installSolidityFiles();
  }

  const res = await runSuper();
  return res;
});

task(TASK_TEST, async (taskArgs: TaskArguments, hre, runSuper) => {
  const fhevmEnv = fhevmContext.get();

  const isZama = await fhevmEnv.isZama();
  if (isZama) {
    throw new HardhatFhevmError("Zama network not yet supported");
  }

  const isLocal = await fhevmEnv.isLocal();
  if (isLocal) {
    await hre.run(TASK_FHEVM_START_LOCAL);
  } else {
    await fhevmEnv.runSetup();
  }

  const res = await runSuper();
  return res;
});
