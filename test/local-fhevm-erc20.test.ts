// tslint:disable-next-line no-implicit-dependencies

import { expect } from "chai";
import { useEnvironment } from "./helpers";
import { TASK_TEST } from "hardhat/builtin-tasks/task-names";
import { HardhatFhevmRuntimeEnvironmentType } from "../src/common/HardhatFhevmRuntimeEnvironment";
import { SCOPE_FHEVM, SCOPE_FHEVM_TASK_STOP } from "../src/task-names";

describe("local tasks tests", function () {
  useEnvironment("local-fhevm-erc20");
  it("LocalFhevm_ERC20: TASK_TEST", async function () {
    expect(this.hre.fhevm.runtimeType === HardhatFhevmRuntimeEnvironmentType.Local);

    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_STOP });

    let isFhevmRunning = await this.hre.fhevm.dockerServices.isFhevmRunning();
    expect(isFhevmRunning).to.eq(false);

    await this.hre.run(TASK_TEST);

    isFhevmRunning = await this.hre.fhevm.dockerServices.isFhevmRunning();
    expect(isFhevmRunning).to.eq(true);

    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_STOP });

    isFhevmRunning = await this.hre.fhevm.dockerServices.isFhevmRunning();
    expect(isFhevmRunning).to.eq(false);
  });
});
