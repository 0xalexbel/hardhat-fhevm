// tslint:disable-next-line no-implicit-dependencies

import { useProjectTemplateEnvironment } from "../helpers";
import "../../src/type-extensions";
import { SCOPE_FHEVM, SCOPE_FHEVM_TASK_INIT_FOUNDRY } from "../../src/task-names";
import { forgeScript } from "../../src/internal/utils/forge";

describe("foundry erc20 tests", function () {
  useProjectTemplateEnvironment("foundry-erc20", undefined, undefined);

  it("forge script", async function () {
    this.hre.fhevm.logOptions = { quiet: true };
    await this.hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_INIT_FOUNDRY });
    await forgeScript("./test_forge/TestEncryptedERC20.s.sol");
  });
});
