import assert from "assert";
import fs from "fs";
import fsExt from "fs-extra";
import path from "path";
import { scope, types } from "hardhat/config";
import {
  SCOPE_FHEVM,
  SCOPE_FHEVM_TASK_INIT_FOUNDRY,
  SCOPE_FHEVM_TASK_INSTALL_SOLIDITY,
  SCOPE_FHEVM_TASK_SETUP,
} from "../task-names";
import { HardhatFhevmType } from "../types";
import { fhevmContext } from "../internal/EnvironmentExtender";
import { FhevmContractsRepository } from "../internal/FhevmContractsRepository";
import { HardhatFhevmError } from "../error";
import { getHHFhevmPackageForgeDir } from "../internal/utils/dirs";
import { installForgeStdUsingSoldeer, isForgeInstalled, writeFoundryToml } from "../internal/utils/forge";
import { FhevmTypeHHFhevm } from "../constants";

const fhevmScope = scope(SCOPE_FHEVM, "Fhevm related commands");

fhevmScope
  .task(SCOPE_FHEVM_TASK_INSTALL_SOLIDITY)
  .setDescription("Install all the required fhevm solidity files associated with the selected network.")
  .addOptionalParam("repoDir", "Directory where the fhevm solidity files will be copied from", undefined, types.string)
  .addOptionalParam("dstDir", "Directory where the fhevm solidity files will be copied to", undefined, types.string)
  .addOptionalParam("fhevmType", "Type native|mock|hh-fhevm", undefined, types.string)
  .addFlag("extTfheLib", "Deploy MockPrecompile contract at address EXT_TFHE_LIBRARY.")
  .setAction(
    async ({
      repoDir,
      dstDir,
      fhevmType,
      extTfheLib,
    }: {
      repoDir: string | undefined;
      dstDir: string | undefined;
      fhevmType: HardhatFhevmType;
      extTfheLib: boolean;
    }) => {
      const fhevmEnv = fhevmContext.get();

      /**
       * If fhevmType === undefined & extTfheLib === undefined
       * Then it is equivalent to calling fhevmEnv.deployOptions.
       */
      const old = fhevmEnv.setUserDeployOptionsNoProvider(fhevmType, extTfheLib);
      assert(fhevmEnv.provider === undefined);

      try {
        repoDir = repoDir ?? fhevmEnv.paths.libFhevmNodeModule;
        // default dstDir is in sync with the CLI params thx to the previous `fhevmEnv.setUserDeployOptionsNoProvider` call
        dstDir = dstDir ?? fhevmEnv.paths.libFhevmSources;

        dstDir = path.resolve(path.normalize(dstDir));
        repoDir = path.resolve(path.normalize(repoDir));

        // should not call fhevmEnv.repository
        // build one manually as they may not have the same init args.
        const srcRepository = new FhevmContractsRepository(repoDir, fhevmEnv.config);

        fhevmEnv.logTrace(`fhevm src repository: ${srcRepository.libDir}`);
        fhevmEnv.logTrace(`fhevm dst repository: ${dstDir}`);

        let dstRepository: FhevmContractsRepository;
        if (dstDir !== srcRepository.libDir) {
          srcRepository.copyToSync(dstDir);
          dstRepository = new FhevmContractsRepository(dstDir, srcRepository.config);
        } else {
          dstRepository = srcRepository;
        }

        await fhevmEnv.installSolidityFiles(dstRepository);
        await fhevmEnv.runCompile({ skipSolInstall: true });
      } finally {
        fhevmEnv.setUserDeployOptions(old);
      }
    },
  );

fhevmScope
  .task(SCOPE_FHEVM_TASK_SETUP)
  .setDescription("Deploy a full fhevm on the selected network.")
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: { quiet: boolean; stderr: boolean }) => {
    const fhevmEnv = fhevmContext.get();

    fhevmEnv.logOptions = { quiet, stderr };
    await fhevmEnv.runSetup();
  });

fhevmScope
  .task(SCOPE_FHEVM_TASK_INIT_FOUNDRY)
  .setDescription("Initialize a new fhevm foundry project.")
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(
    async (
      {
        quiet,
        stderr,
      }: {
        quiet: boolean;
        stderr: boolean;
      },
      hre,
    ) => {
      const fhevmEnv = fhevmContext.get();
      const old = fhevmEnv.setUserDeployOptionsNoProvider(FhevmTypeHHFhevm, true);

      const forgeSrcDir = getHHFhevmPackageForgeDir();
      const forgeDstDir = fhevmEnv.paths.HHFhevmForgeSources;

      if (!fs.existsSync(forgeSrcDir)) {
        throw new HardhatFhevmError(`Directory ${forgeSrcDir} does not exist`);
      }

      const remappings = fhevmEnv.getForgeRemappings();
      try {
        fhevmEnv.logOptions = { quiet, stderr };

        if (!(await isForgeInstalled())) {
          fhevmEnv.logBox(
            `Forge is not installed, please install forge, see https://book.getfoundry.sh/getting-started/installation`,
          );
        }

        const foundryToml = path.join(hre.config.paths.root, "foundry.toml");

        if (!fs.existsSync(foundryToml)) {
          writeFoundryToml(foundryToml, "1.9.3", "0.8.24", remappings);
          await installForgeStdUsingSoldeer(foundryToml);
        }

        await fhevmEnv.installSolidityFiles();

        // install forge directory
        fsExt.copySync(forgeSrcDir, forgeDstDir, {
          overwrite: true,
          dereference: true,
          //recursive: true,
        });
      } finally {
        fhevmEnv.setUserDeployOptions(old);
      }
    },
  );
