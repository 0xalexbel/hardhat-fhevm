import { ResultCallbackProcessor } from "../common/ResultCallbackProcessor";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export class LocalResultCallbackProcessor extends ResultCallbackProcessor {
  constructor(hre: HardhatRuntimeEnvironment & { __SOLIDITY_COVERAGE_RUNNING?: boolean }) {
    super(hre);
  }
  protected override async tryDecrypt(/*requestIDs: bigint[]*/): Promise<void> {}
}
