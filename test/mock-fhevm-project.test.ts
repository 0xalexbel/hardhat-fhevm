// tslint:disable-next-line no-implicit-dependencies
import { assert } from "chai";
import fs from "fs";

import { TASK_FHEVM_COMPILE, TASK_FHEVM_WRITE_CONTRACT } from "../src/internal-task-names";

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
  writeLibGateway,
} from "../src/common/contracts";
import { TASK_COMPILE, TASK_TEST } from "hardhat/builtin-tasks/task-names";

describe("mock tasks tests", function () {
  useEnvironment("hardhat-mock-fhevm-project");

  it("Mock1: TASK_FHEVM_WRITE_GATEWAY_CONTRACT", async function () {
    const res = await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "GatewayContract", force: true });
    assert(res.address === "0xc8c9303Cd7F337fab769686B593B87DC3403E0ce");
    const params = getGatewayContractParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
  });

  it("Mock2: TASK_FHEVM_WRITE_ACL_CONTRACT", async function () {
    const res = await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "ACL", force: true });
    assert(res.address === "0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92");
    const params = getACLParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
    assert(readACLAddress(getUserPackageNodeModulesDir(this.hre.config)) === res.address);
  });

  it("Mock3: TASK_FHEVM_WRITE_KMS_VERIFIER_CONTRACT", async function () {
    const res = await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "KMSVerifier", force: true });
    assert(res.address === "0x12B064FB845C1cc05e9493856a1D637a73e944bE");
    const params = getKMSVerifierParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
    assert(readKMSVerifierAddress(getUserPackageNodeModulesDir(this.hre.config)) === res.address);
  });

  it("Mock4: TASK_FHEVM_WRITE_TFHE_EXECUTOR_CONTRACT", async function () {
    const res = await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "TFHEExecutor", force: true });
    assert(res.address === "0x05fD9B5EFE0a996095f42Ed7e77c390810CF660c");
    const params = getTFHEExecutorParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
    assert(readTFHEExecutorAddress(getUserPackageNodeModulesDir(this.hre.config)) === res.address);
  });

  it("Mock5: TASK_FHEVM_COMPILE", async function () {
    await this.hre.run(TASK_FHEVM_COMPILE);
  });

  it("Mock6: TASK_COMPILE_CONTRACTS", async function () {
    await this.hre.run(TASK_FHEVM_COMPILE);
    await this.hre.run(TASK_COMPILE);
  });

  it("Mock7: TASK_COMPILE", async function () {
    await this.hre.run(TASK_COMPILE);

    // Try re-write Gateway.sol, nothing should happen
    const re_write_gateway_sol = writeLibGateway(
      {
        ACL: "0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92",
        KMSVerifier: "0x12B064FB845C1cc05e9493856a1D637a73e944bE",
        GatewayContract: "0xc8c9303Cd7F337fab769686B593B87DC3403E0ce",
      },
      this.hre,
    );

    assert(!re_write_gateway_sol);
  });

  it("Mock8: TASK_TEST", async function () {
    await this.hre.run(TASK_TEST);
  });
});
