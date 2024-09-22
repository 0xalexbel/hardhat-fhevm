// tslint:disable-next-line no-implicit-dependencies
import { HardhatRuntimeEnvironment, JsonRpcServer } from "hardhat/types";

import { useEnvironment } from "./helpers";
import { TASK_NODE, TASK_NODE_SERVER_READY, TASK_TEST } from "hardhat/builtin-tasks/task-names";
import { expect } from "chai";

describe("mock tasks tests", function () {
  useEnvironment("node-mock-async-decrypt");

  function runTest(hre: HardhatRuntimeEnvironment, testFunc: (hre: HardhatRuntimeEnvironment) => Promise<void>) {
    hre.tasks[TASK_NODE_SERVER_READY].setAction(
      async ({ server }: { server: JsonRpcServer }, hre: HardhatRuntimeEnvironment) => {
        try {
          await testFunc(hre);
        } catch (e) {
          console.log(e);
        }
        server.close();
      },
    );
  }

  async function test1(hre: HardhatRuntimeEnvironment) {
    hre.fhevm.logOptions = { quiet: true };
    // By default, when running standalone hardhat node, use on-chain mock
    expect(hre.network.config.useOnChainFhevmMockProcessor).is.eq(true);
    await hre.run(TASK_TEST);
  }

  async function test2(hre: HardhatRuntimeEnvironment) {
    hre.fhevm.logOptions = { quiet: true };
    // By default, when running standalone hardhat node, use on-chain mock
    expect(hre.network.config.useOnChainFhevmMockProcessor).is.eq(true);
    hre.network.config.useOnChainFhevmMockProcessor = false;
    await hre.run(TASK_TEST);
  }

  it("NodeMockAsyncDecrypt1: TASK_TEST", async function () {
    runTest(this.hre, test1);
    await this.hre.run(TASK_NODE);
  });

  it("NodeMockAsyncDecrypt2: TASK_TEST", async function () {
    runTest(this.hre, test2);
    await this.hre.run(TASK_NODE);
  });
});