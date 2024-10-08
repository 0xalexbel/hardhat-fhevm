import { resetHardhatContext } from "hardhat/plugins-testing";
import path from "path";
import fsPromises from "fs/promises";
import fs from "fs";
import rimraf from "rimraf";
import { assert } from "chai";
import type { FhevmEnvironment } from "../src/internal/FhevmEnvironment";

////////////////////////////////////////////////////////////////////////////////

declare module "mocha" {
  interface Context {
    fhevmEnv: FhevmEnvironment;
  }
}

////////////////////////////////////////////////////////////////////////////////

const fixtureProjectTemplatesDir = "fixture-project-templates";
const fixtureProjectsDir = "fixture-projects";

export function useProjectTemplateEnvironment(
  templateName: string,
  hhConfigName: string | undefined,
  tmpDir: string | undefined,
) {
  //const packageDir = path.normalize(path.join(__dirname, ".."));
  tmpDir = tmpDir !== undefined ? tmpDir : "tmp";

  const templateDir = path.join(__dirname, fixtureProjectTemplatesDir, `${templateName}-project-template`);

  const projectName =
    hhConfigName === undefined ? `${templateName}-project` : `${hhConfigName}-${templateName}-project`;

  const dstDir = path.isAbsolute(tmpDir)
    ? path.normalize(path.join(tmpDir, projectName))
    : path.normalize(path.join(__dirname, tmpDir, projectName));

  beforeEach("Loading hardhat environment", async function () {
    const dstNodeModulesDir = path.join(dstDir, "node_modules");

    const srcConfig =
      hhConfigName === undefined
        ? path.join(templateDir, `hardhat.config.ts`)
        : path.join(templateDir, `${hhConfigName}.config.ts`);
    const dstConfig = path.join(dstDir, `hardhat.config.ts`);

    await rimraf(dstDir);
    await fsPromises.cp(templateDir, dstDir, { recursive: true, dereference: true });

    fs.copyFileSync(srcConfig, dstConfig);

    await installFhevmSolidityContracts(dstNodeModulesDir);

    process.chdir(dstDir);
    const { fhevmContext } = await import("../src/internal/EnvironmentExtender");

    /**
     * Warning:
     * 1- load hardhat + hardhat.config
     * 2- This will call the EnvironmentExtender
     * 3- And fhevmContext.fhevmEnv will be initialized
     *
     * Do not call 'this.fhevmEnv' directly!!
     *
     */
    this.hre = await import("hardhat");
    this.fhevmEnv = fhevmContext.get();
  });

  afterEach("Resetting hardhat", async function () {
    await rimraf(dstDir);
    const { fhevmContext } = await import("../src/internal/EnvironmentExtender");
    fhevmContext.fhevmEnv = undefined;
    resetHardhatContext();
  });
}

////////////////////////////////////////////////////////////////////////////////

export function useProjectEnvironment(fixtureProjectName: string) {
  beforeEach("Loading hardhat environment", async function () {
    process.chdir(path.join(__dirname, fixtureProjectsDir, fixtureProjectName));
    const { fhevmContext } = await import("../src/internal/EnvironmentExtender");

    /**
     * Warning:
     * 1- load hardhat + hardhat.config
     * 2- This will call the EnvironmentExtender
     * 3- And fhevmContext.fhevmEnv will be initialized
     *
     * Do not call 'this.fhevmEnv' directly!!
     *
     */
    this.hre = await import("hardhat");
    this.fhevmEnv = fhevmContext.get();

    await resetFixtureProject(fixtureProjectName, this.fhevmEnv);

    const fixtureProjectNodeModules = this.fhevmEnv.paths.nodeModules;

    // Better be sure before rimraffing...
    assert(
      fixtureProjectNodeModules ===
        path.normalize(path.join(__dirname, fixtureProjectsDir, fixtureProjectName, "node_modules")),
    );
    assert(path.dirname(this.fhevmEnv.paths.cache) === path.join(path.dirname(fixtureProjectNodeModules), "hh-fhevm"));

    await installFhevmSolidityContracts(fixtureProjectNodeModules);
  });

  afterEach("Resetting hardhat", async function () {
    await resetFixtureProject(fixtureProjectName, this.fhevmEnv);
    const { fhevmContext } = await import("../src/internal/EnvironmentExtender");
    fhevmContext.fhevmEnv = undefined;
    resetHardhatContext();
  });
}

////////////////////////////////////////////////////////////////////////////////

async function resetFixtureProject(fixtureProjectName: string, fhevmEnv: FhevmEnvironment) {
  assert(fhevmEnv);
  const fixtureProjectNodeModules = fhevmEnv.paths.nodeModules;

  // Better be sure before rimraffing...
  assert(
    fixtureProjectNodeModules ===
      path.normalize(path.join(__dirname, fixtureProjectsDir, fixtureProjectName, "node_modules")),
    `wrong path ${fixtureProjectNodeModules}`,
  );
  assert(path.dirname(fhevmEnv.paths.cache) === path.join(path.dirname(fixtureProjectNodeModules), "hh-fhevm"));

  await rimraf(path.dirname(fhevmEnv.paths.cache));
  await rimraf(fhevmEnv.hre.config.paths.cache);
  await rimraf(fhevmEnv.hre.config.paths.artifacts);
  await rimraf(path.join(fhevmEnv.hre.config.paths.root, "types"));
  await rimraf(fixtureProjectNodeModules);
}

////////////////////////////////////////////////////////////////////////////////

async function installFhevmSolidityContracts(fixtureProjectNodeModules: string) {
  // Install package fhevm
  // hardhat-fhevm/node_modules/fhevm
  let src = path.normalize(path.join(__dirname, "../node_modules", "fhevm"));
  assert(fs.existsSync(src), "unable to find fhevm dependency module in hardhat-fhevm plugin package");

  // path/to/fixture-projects/node_modules/fhevm
  let dst = path.normalize(path.join(fixtureProjectNodeModules, "fhevm"));
  await fsPromises.cp(src, dst, { recursive: true, dereference: true });

  // Install package openzeppelin
  // hardhat-fhevm/node_modules/@openzeppelin/contracts
  src = path.normalize(path.join(__dirname, "../node_modules", "@openzeppelin/contracts"));
  // path/to/fixture-projects/node_modules/@openzeppelin/contracts
  dst = path.normalize(path.join(fixtureProjectNodeModules, "@openzeppelin/contracts"));
  await fsPromises.cp(src, dst, { recursive: true, dereference: true });
}

////////////////////////////////////////////////////////////////////////////////
