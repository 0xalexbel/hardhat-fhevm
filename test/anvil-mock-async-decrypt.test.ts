// tslint:disable-next-line no-implicit-dependencies

import { expect } from "chai";
import { useEnvironment } from "./helpers";
import { TASK_TEST } from "hardhat/builtin-tasks/task-names";

describe("anvil mock async decrypt tests", function () {
  useEnvironment("anvil-mock-async-decrypt");

  it("AnvilFastMock_AsyncDecrypt: TASK_TEST", async function () {
    expect(this.hre.network.config.useOnChainFhevmMockProcessor).is.eq(undefined);
    // When using Anvil, on-chain mock db is the default behaviour
    expect(await this.hre.fhevm.useMockOnChainDecryption()).is.eq(true);
    this.hre.fhevm.logOptions = { quiet: true };
    await this.hre.run(TASK_TEST);
  });
});
