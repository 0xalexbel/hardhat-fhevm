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
  getMnemonicPhrase,
  writeLibGateway,
} from "../src/common/contracts";
import { TASK_COMPILE, TASK_TEST } from "hardhat/builtin-tasks/task-names";

describe("mock mnemonic tasks tests", function () {
  useEnvironment("hardhat-mock-fhevm-project-with-mnemonic");

  it("should use the default hardhat mnemonic", async function () {
    const m = getMnemonicPhrase(this.hre.config);
    assert(m === "test test test test test test test test test test test junk");
  });

  it("Mnemonic1: TASK_FHEVM_WRITE_GATEWAY_CONTRACT", async function () {
    const res = await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "GatewayContract", force: false });
    assert(res.changed);
    assert(res.address === "0xbdEd0D2bf404bdcBa897a74E6657f1f12e5C6fb6");
    const params = getGatewayContractParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
  });

  it("Mnemonic2: TASK_FHEVM_WRITE_ACL_CONTRACT", async function () {
    const res = await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "ACL", force: false });
    assert(res.changed);
    assert(res.address === "0x700b6A60ce7EaaEA56F065753d8dcB9653dbAD35");
    const params = getACLParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
    assert(readACLAddress(getUserPackageNodeModulesDir(this.hre.config)) === res.address);
  });

  it("Mnemonic3: TASK_FHEVM_WRITE_KMS_VERIFIER_CONTRACT", async function () {
    const res = await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "KMSVerifier", force: false });
    assert(res.changed);
    assert(res.address === "0xb19b36b1456E65E3A6D514D3F715f204BD59f431");
    const params = getKMSVerifierParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
    assert(readKMSVerifierAddress(getUserPackageNodeModulesDir(this.hre.config)) === res.address);
  });

  it("Mnemonic4: TASK_FHEVM_WRITE_TFHE_EXECUTOR_CONTRACT", async function () {
    const res = await this.hre.run(TASK_FHEVM_WRITE_CONTRACT, { contractName: "TFHEExecutor", force: false });
    assert(res.changed);
    assert(res.address === "0xA15BB66138824a1c7167f5E85b957d04Dd34E468");
    const params = getTFHEExecutorParams(getUserPackageNodeModulesDir(this.hre.config));
    assert(fs.existsSync(params.contractAddressPath));
    assert(fs.existsSync(params.dotenvPath));
    assert(readTFHEExecutorAddress(getUserPackageNodeModulesDir(this.hre.config)) === res.address);
  });

  it("Mnemonic5: TASK_FHEVM_COMPILE", async function () {
    await this.hre.run(TASK_FHEVM_COMPILE);
  });

  it("Mnemonic6: TASK_COMPILE_CONTRACTS", async function () {
    await this.hre.run(TASK_FHEVM_COMPILE);
    await this.hre.run(TASK_COMPILE);
  });

  it("Mnemonic7: TASK_COMPILE", async function () {
    await this.hre.run(TASK_COMPILE);

    // Try re-write Gateway.sol, nothing shoudl happen
    const re_write_gateway_sol = writeLibGateway(
      {
        ACL: "0x700b6A60ce7EaaEA56F065753d8dcB9653dbAD35",
        KMSVerifier: "0xb19b36b1456E65E3A6D514D3F715f204BD59f431",
        GatewayContract: "0xbdEd0D2bf404bdcBa897a74E6657f1f12e5C6fb6",
      },
      this.hre,
    );

    assert(!re_write_gateway_sol);
  });

  it("Mnemonic8: TASK_TEST", async function () {
    await this.hre.run(TASK_TEST);
  });
});
