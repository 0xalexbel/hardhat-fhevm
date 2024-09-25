// tslint:disable-next-line no-implicit-dependencies

import { expect } from "chai";
import { useEnvironment } from "./helpers";
import { TASK_TEST } from "hardhat/builtin-tasks/task-names";
import { SCOPE_FHEVM, SCOPE_FHEVM_TASK_STOP } from "../src/task-names";
import { HardhatFhevmProviderType } from "../src/common/HardhatFhevmProviderType";

describe("local fhevm async decrypt tests", function () {
  useEnvironment("local-fhevm-async-decrypt");
  it("LocalFhevm_AsyncDecrypt: TASK_TEST", async function () {
    expect((await this.hre.fhevm.getProviderType()) === HardhatFhevmProviderType.Local);
    expect(await this.hre.fhevm.useMockOnChainDecryption()).is.eq(false);
    expect(await this.hre.fhevm.useMock()).is.eq(false);

    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_STOP });

    let isFhevmRunning = await this.hre.fhevm.isRunning();
    expect(isFhevmRunning).to.eq(false);

    await this.hre.run(TASK_TEST);

    isFhevmRunning = await this.hre.fhevm.isRunning();
    expect(isFhevmRunning).to.eq(true);

    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_STOP });

    isFhevmRunning = await this.hre.fhevm.isRunning();
    expect(isFhevmRunning).to.eq(false);
  });
});
