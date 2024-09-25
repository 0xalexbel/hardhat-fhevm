// tslint:disable-next-line no-implicit-dependencies

import { expect } from "chai";
import { useEnvironment } from "./helpers";
import { TASK_TEST } from "hardhat/builtin-tasks/task-names";

describe("mock async decrypt tests", function () {
  useEnvironment("hardhat-mock-async-decrypt");

  it("Mock_AsyncDecrypt: TASK_TEST", async function () {
    expect(this.hre.network.config.mockFhevm).is.eq(true);
    expect(this.hre.network.config.useOnChainFhevmMockProcessor).is.eq(false);

    expect(await this.hre.fhevm.useMockOnChainDecryption()).is.eq(false);

    this.hre.fhevm.logOptions = { quiet: true };
    await this.hre.run(TASK_TEST);
  });

  it("FastMock_AsyncDecrypt: TASK_TEST", async function () {
    expect(this.hre.network.config.mockFhevm).is.eq(true);
    expect(this.hre.network.config.useOnChainFhevmMockProcessor).is.eq(false);

    this.hre.network.config.useOnChainFhevmMockProcessor = true;
    expect(await this.hre.fhevm.useMockOnChainDecryption()).is.eq(true);

    this.hre.fhevm.logOptions = { quiet: true };
    await this.hre.run(TASK_TEST);
  });
});
