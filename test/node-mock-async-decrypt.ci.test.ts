// tslint:disable-next-line no-implicit-dependencies
import { HardhatRuntimeEnvironment, JsonRpcServer } from "hardhat/types";

import { useEnvironment } from "./helpers";
import { TASK_NODE, TASK_NODE_SERVER_READY, TASK_TEST } from "hardhat/builtin-tasks/task-names";
import { expect } from "chai";

describe("node mock async decrypt tests BBBB", function () {
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
    // By default, when running standalone hardhat node, use on-chain mock
    expect(hre.network.config.useOnChainFhevmMockProcessor).is.eq(undefined);
    expect(await hre.fhevm.useMockOnChainDecryption()).is.eq(true);

    hre.fhevm.logOptions = { quiet: true };
    await hre.run(TASK_TEST);
  }

  async function test(hre: HardhatRuntimeEnvironment) {
    expect(hre.network.config.useOnChainFhevmMockProcessor).is.eq(undefined);
    // By default, when running standalone hardhat node, use on-chain mock
    // must change manually to use standard mock
    hre.network.config.useOnChainFhevmMockProcessor = false;
    expect(await hre.fhevm.useMockOnChainDecryption()).is.eq(false);
    hre.fhevm.logOptions = { quiet: true };
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
