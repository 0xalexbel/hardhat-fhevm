// tslint:disable-next-line no-implicit-dependencies

import { expect } from "chai";
import { useEnvironment } from "./helpers";
import { TASK_TEST } from "hardhat/builtin-tasks/task-names";

describe("anvil mock async decrypt tests", function () {
  useEnvironment("anvil-mock-async-decrypt");

  it("AnvilFastMock_AsyncDecrypt: TASK_TEST", async function () {
    this.hre.fhevm.logOptions = { quiet: true };
    // By default, when running anvil, use on-chain mock
    expect(this.hre.network.config.useOnChainFhevmMockProcessor).is.eq(true);
    await this.hre.run(TASK_TEST);
  });
});
