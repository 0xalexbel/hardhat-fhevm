// tslint:disable-next-line no-implicit-dependencies
import { expect } from "chai";

import {
  SCOPE_FHEVM,
  SCOPE_FHEVM_TASK_RESTART,
  SCOPE_FHEVM_TASK_START,
  SCOPE_FHEVM_TASK_STOP,
} from "../src/task-names";
import { useEnvironment } from "./helpers";

describe("local tasks tests", function () {
  useEnvironment("local-fhevm-project");

  it("LocalStartStop1: TASK_FHEVM_START", async function () {
    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_START });

    const isFhevmRunning = await this.hre.fhevm.dockerServices.isFhevmRunning();
    expect(isFhevmRunning).to.eq(true);
  });

  it("LocalStartStop2: TASK_FHEVM_STOP", async function () {
    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_START });

    let isFhevmRunning = await this.hre.fhevm.dockerServices.isFhevmRunning();
    expect(isFhevmRunning).to.eq(true);

    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_STOP });

    isFhevmRunning = await this.hre.fhevm.dockerServices.isFhevmRunning();
    expect(isFhevmRunning).to.eq(false);
  });

  it("LocalStartStop3: TASK_FHEVM_RESTART", async function () {
    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_START });

    let isFhevmRunning = await this.hre.fhevm.dockerServices.isFhevmRunning();
    expect(isFhevmRunning).to.eq(true);

    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_RESTART });

    isFhevmRunning = await this.hre.fhevm.dockerServices.isFhevmRunning();
    expect(isFhevmRunning).to.eq(true);

    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_STOP });

    isFhevmRunning = await this.hre.fhevm.dockerServices.isFhevmRunning();
    expect(isFhevmRunning).to.eq(false);
  });

  it("LocalStartStop2: TASK_FHEVM_START quiet", async function () {
    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_STOP }, { quiet: true });

    let isFhevmRunning = await this.hre.fhevm.dockerServices.isFhevmRunning();
    expect(isFhevmRunning).to.eq(false);

    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_START }, { quiet: true });

    isFhevmRunning = await this.hre.fhevm.dockerServices.isFhevmRunning();
    expect(isFhevmRunning).to.eq(true);

    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_STOP }, { quiet: true });

    isFhevmRunning = await this.hre.fhevm.dockerServices.isFhevmRunning();
    expect(isFhevmRunning).to.eq(false);
  });
});
