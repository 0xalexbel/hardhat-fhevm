// tslint:disable-next-line no-implicit-dependencies
import { assert } from "chai";
import fs from "fs";

import {
  SCOPE_FHEVM,
  SCOPE_FHEVM_TASK_START,
  SCOPE_FHEVM_TASK_STOP,
  TASK_FHEVM_COMPILE,
  TASK_FHEVM_CREATE_KEYS,
  TASK_FHEVM_REMOVE_KEYS,
  TASK_FHEVM_VERIFY_CONTRACTS,
  TASK_FHEVM_WRITE_CONTRACT,
} from "../src/task-names";

import { useEnvironment } from "./helpers";
import {
  getACLParams,
  getUserPackageNodeModulesDir,
  getGatewayContractParams,
  getKMSVerifierParams,
  getTFHEExecutorParams,
  readACLAddress,
  readKMSVerifierAddress,
  readTFHEExecutorAddress,
} from "../src/common/contracts";
import {
  getInstallKeysDir,
  getInstallPrivKeyFile,
  getInstallPubKeyFile,
  getInstallServerKeyFile,
} from "../src/common/dirs";
import { TASK_COMPILE, TASK_TEST } from "hardhat/builtin-tasks/task-names";

describe("local tasks tests", function () {
  useEnvironment("hardhat-local-fhevm-project");

  it("Local1: TASK_FHEVM_CREATE_KEYS", async function () {
    assert(!fs.existsSync(this.hre.config.paths.fhevm));
    await this.hre.run(TASK_FHEVM_CREATE_KEYS);
    const keysDir = getInstallKeysDir(this.hre);
    assert(fs.existsSync(keysDir));
    assert(fs.existsSync(getInstallPrivKeyFile(this.hre)));
    assert(fs.existsSync(getInstallPubKeyFile(this.hre)));
    assert(fs.existsSync(getInstallServerKeyFile(this.hre)));
  });

  it("Local2: TASK_FHEVM_REMOVE_KEYS", async function () {
    const keysDir = getInstallKeysDir(this.hre);
    assert(!fs.existsSync(keysDir));
    await this.hre.run(TASK_FHEVM_CREATE_KEYS);
    await this.hre.run(TASK_FHEVM_REMOVE_KEYS);
    assert(!fs.existsSync(keysDir), `file ${keysDir} still exists!`);
  });

  it("Local3: TASK_FHEVM_WRITE_GATEWAY_CONTRACT", async function () {
    await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "GatewayContract", force: true });
    const params = getGatewayContractParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
  });

  it("Local4: TASK_FHEVM_WRITE_ACL_CONTRACT", async function () {
    const res = await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "ACL", force: true });
    const params = getACLParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
    assert(readACLAddress(getUserPackageNodeModulesDir(this.hre.config)) === res.address);
  });

  it("Local5: TASK_FHEVM_WRITE_KMS_VERIFIER_CONTRACT", async function () {
    const res = await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "KMSVerifier", force: true });
    const params = getKMSVerifierParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
    assert(readKMSVerifierAddress(getUserPackageNodeModulesDir(this.hre.config)) === res.address);
  });

  it("Local6: TASK_FHEVM_WRITE_TFHE_EXECUTOR_CONTRACT", async function () {
    const res = await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "TFHEExecutor", force: true });
    const params = getTFHEExecutorParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
    assert(readTFHEExecutorAddress(getUserPackageNodeModulesDir(this.hre.config)) === res.address);
  });

  it("Local7: TASK_FHEVM_VERIFY_CONTRACTS", async function () {
    await this.hre.run(TASK_FHEVM_VERIFY_CONTRACTS);
  });

  it("Local8: TASK_FHEVM_COMPILE", async function () {
    await this.hre.run(TASK_FHEVM_COMPILE);
  });

  it("Local9: TASK_COMPILE_CONTRACTS", async function () {
    await this.hre.run(TASK_FHEVM_COMPILE);
    await this.hre.run(TASK_COMPILE);
  });

  it("Local10: TASK_FHEVM_START", async function () {
    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_START });
    assert(await this.hre.fhevm.dockerServices().isFhevmRunning(), "Fhevm docker services are not running!");
  });

  it("Local11: TASK_FHEVM_STOP", async function () {
    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_START });
    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_STOP });
    assert(!(await this.hre.fhevm.dockerServices().isFhevmRunning()), "Fhevm docker services are still running!");
  });

  it("Local12: TASK_TEST", async function () {
    //assert(!(await this.hre.fhevm.dockerServices().isFhevmRunning()), "Fhevm docker services should not be running!");
    await this.hre.run(TASK_TEST);
  });
});
