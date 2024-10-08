import assert from "assert";
import { EnvironmentExtender, HardhatRuntimeEnvironment } from "hardhat/types";
import { FhevmEnvironment } from "./FhevmEnvironment";
import { lazyObject } from "hardhat/plugins";
import { HardhatFhevmError } from "../error";

export const fhevmContext: { fhevmEnv: FhevmEnvironment | undefined; get: () => FhevmEnvironment } = {
  fhevmEnv: undefined,
  get: () => {
    if (!fhevmContext.fhevmEnv) {
      throw new HardhatFhevmError("Unable to initialize HardhatFhevmRuntimeEnvironment");
    }
    return fhevmContext.fhevmEnv;
  },
};

/**
 * Hardhat EnvironmentExtender
 * Called at Hardhat initialization
 */
export const envExtender: EnvironmentExtender = (env: HardhatRuntimeEnvironment) => {
  /**
   * Very lightweight
   */
  assert(fhevmContext.fhevmEnv === undefined, "fhevmContext.fhevmEnv already created");
  fhevmContext.fhevmEnv = lazyObject(() => {
    return new FhevmEnvironment(env);
  });

  env.fhevm = lazyObject(() => {
    return fhevmContext.get().externalFhevmAPI;
  });

  // setTimeout(async () => {
  //   await GLOBAL_FHEVM_ENVIRONMENT.initAsync(env);
  //   hre.fhevm = GLOBAL_FHEVM_ENVIRONMENT.fhevm;
  // }, 0);
};
