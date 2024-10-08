import { expect } from "chai";
import { useProjectTemplateEnvironment } from "../helpers";
import { TASK_TEST } from "hardhat/builtin-tasks/task-names";

export function runConfigAndTaskTest(network: string, fhevmType: string, contract: string) {
  return function () {
    const testType = `${network}-${fhevmType}`;

    useProjectTemplateEnvironment(contract, testType, undefined);

    it(`${testType}-${contract} config`, async function () {
      const [signer] = await this.hre.ethers.getSigners();
      // mnemonic= test test ... junk
      expect(signer.address).to.eq("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");

      expect(this.fhevmEnv.hre.network.config.fhevm).is.eq(fhevmType);
      expect(this.fhevmEnv.hre.network.name).is.eq(network);

      const deployOptions = this.fhevmEnv.deployOptions;

      // deployed using ZamaDev default mnemonic
      expect(this.fhevmEnv.repository.computeAddress("ACL", deployOptions)).is.eq(
        "0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92",
      );
    });

    it(`${testType}-${contract} : TASK_TEST`, async function () {
      this.hre.fhevm.logOptions = { quiet: true };
      await this.hre.run(TASK_TEST);
    });
  };
}

export function runTaskTestOnly(network: string, fhevmType: string, contract: string) {
  return function () {
    const testType = `${network}-${fhevmType}`;

    useProjectTemplateEnvironment(contract, testType, undefined);

    it(`${testType}-${contract} : TASK_TEST`, async function () {
      this.hre.fhevm.logOptions = { quiet: true };
      await this.hre.run(TASK_TEST);
    });
  };
}
