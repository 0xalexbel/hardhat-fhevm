// tslint:disable-next-line no-implicit-dependencies
import { assert } from "chai";
import fs from "fs";

import { TASK_FHEVM_COMPILE, TASK_FHEVM_WRITE_CONTRACT } from "../src/task-names";

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
import { TASK_COMPILE, TASK_TEST } from "hardhat/builtin-tasks/task-names";

describe("mock tasks tests", function () {
  useEnvironment("hardhat-mock-fhevm-project");

  it("TASK_FHEVM_WRITE_GATEWAY_CONTRACT", async function () {
    await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "GatewayContract" });
    const params = getGatewayContractParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
  });

  it("TASK_FHEVM_WRITE_ACL_CONTRACT", async function () {
    const res = await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "ACL" });
    const params = getACLParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
    assert(readACLAddress(getUserPackageNodeModulesDir(this.hre.config)) === res.address);
  });

  it("TASK_FHEVM_WRITE_KMS_VERIFIER_CONTRACT", async function () {
    const res = await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "KMSVerifier" });
    const params = getKMSVerifierParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
    assert(readKMSVerifierAddress(getUserPackageNodeModulesDir(this.hre.config)) === res.address);
  });

  it("TASK_FHEVM_WRITE_TFHE_EXECUTOR_CONTRACT", async function () {
    const res = await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "TFHEExecutor" });
    const params = getTFHEExecutorParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
    assert(readTFHEExecutorAddress(getUserPackageNodeModulesDir(this.hre.config)) === res.address);
  });

  it("TASK_FHEVM_COMPILE", async function () {
    await this.hre.run(TASK_FHEVM_COMPILE);
  });

  it("TASK_COMPILE_CONTRACTS", async function () {
    await this.hre.run(TASK_FHEVM_COMPILE);
    await this.hre.run(TASK_COMPILE);
  });

  it("TASK_FHEVM_TEST", async function () {
    await this.hre.run(TASK_TEST);
  });
});
