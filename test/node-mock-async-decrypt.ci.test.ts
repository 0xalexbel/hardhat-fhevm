// tslint:disable-next-line no-implicit-dependencies
import { HardhatRuntimeEnvironment, JsonRpcServer } from "hardhat/types";

import { useEnvironment } from "./helpers";
import { TASK_NODE, TASK_NODE_SERVER_READY, TASK_TEST } from "hardhat/builtin-tasks/task-names";
import { expect } from "chai";

describe("node mock async decrypt tests", function () {
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

  async function testFast(hre: HardhatRuntimeEnvironment) {
    hre.fhevm.logOptions = { quiet: true };
    // By default, when running standalone hardhat node, use on-chain mock
    expect(hre.network.config.useOnChainFhevmMockProcessor).is.eq(true);
    await hre.run(TASK_TEST);
  }

  async function test(hre: HardhatRuntimeEnvironment) {
    hre.fhevm.logOptions = { quiet: true };
    // By default, when running standalone hardhat node, use on-chain mock
    expect(hre.network.config.useOnChainFhevmMockProcessor).is.eq(true);
    hre.network.config.useOnChainFhevmMockProcessor = false;
    await hre.run(TASK_TEST);
  }

  it("NodeMockFast_AsyncDecrypt: TASK_TEST", async function () {
    runTest(this.hre, testFast);
    await this.hre.run(TASK_NODE);
  });

  it("NodeMock_AsyncDecrypt: TASK_TEST", async function () {
    runTest(this.hre, test);
    await this.hre.run(TASK_NODE);
  });
});
