import { resetHardhatContext } from "hardhat/plugins-testing";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import path from "path";
import fs from "fs/promises";
import rimraf from "rimraf";
import { assert } from "chai";
//import "../src/type-extensions";

declare module "mocha" {
  interface Context {
    hre: HardhatRuntimeEnvironment;
  }
}

export function useEnvironment(fixtureProjectName: string) {
  beforeEach("Loading hardhat environment", async function () {
    process.chdir(path.join(__dirname, "fixture-projects", fixtureProjectName));
    this.hre = require("hardhat");

    await resetFixtureProject(fixtureProjectName, this.hre);
    await installFhevmSolidityContracts(fixtureProjectName, this.hre);
  });

  afterEach("Resetting hardhat", async function () {
    await resetFixtureProject(fixtureProjectName, this.hre);
    resetHardhatContext();
  });
}

async function installFhevmSolidityContracts(fixtureProjectName: string, hre: HardhatRuntimeEnvironment) {
  const fixtureProjectNodeModules = path.join(hre.config.paths.root, "node_modules");
  //getUserPackageNodeModulesDir(hre.config);

  // Better be sure before rimraffing...
  assert(
    fixtureProjectNodeModules ===
      path.normalize(path.join(__dirname, "fixture-projects", fixtureProjectName, "node_modules")),
  );

  // Install package fhevm
  // hardhat-fhevm/node_modules/fhevm
  let src = path.normalize(path.join(__dirname, "../node_modules", "fhevm"));
  // path/to/fixture-projects/node_modules/fhevm
  let dst = path.normalize(path.join(fixtureProjectNodeModules, "fhevm"));
  await fs.cp(src, dst, { recursive: true, dereference: true });

  // Install package openzeppelin
  // hardhat-fhevm/node_modules/@openzeppelin/contracts
  src = path.normalize(path.join(__dirname, "../node_modules", "@openzeppelin/contracts"));
  // path/to/fixture-projects/node_modules/@openzeppelin/contracts
  dst = path.normalize(path.join(fixtureProjectNodeModules, "@openzeppelin/contracts"));
  await fs.cp(src, dst, { recursive: true, dereference: true });
}

async function resetFixtureProject(fixtureProjectName: string, hre: HardhatRuntimeEnvironment) {
  //const fixtureProjectNodeModules = getUserPackageNodeModulesDir(hre.config);
  const fixtureProjectNodeModules = path.join(hre.config.paths.root, "node_modules");

  // Better be sure before rimraffing...
  assert(
    fixtureProjectNodeModules ===
      path.normalize(path.join(__dirname, "fixture-projects", fixtureProjectName, "node_modules")),
    `wrong path ${fixtureProjectNodeModules}`,
  );

  await rimraf(hre.config.paths.fhevm);
  await rimraf(hre.config.paths.cache);
  await rimraf(hre.config.paths.artifacts);
  await rimraf(path.join(hre.config.paths.root, "types"));
  await rimraf(fixtureProjectNodeModules);
}
