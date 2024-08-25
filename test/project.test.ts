// tslint:disable-next-line no-implicit-dependencies
import { assert } from "chai";
import path from "path";

import { useEnvironment } from "./helpers";
import { DEFAULT_CONFIG_PATH_FHEVM } from "../src/constants";

describe("Integration tests examples", function () {
  describe("HardhatConfig extension", function () {
    useEnvironment("hardhat-mock-fhevm-project");

    it("Should add the fhevm path to the config", function () {
      assert.equal(this.hre.config.paths.fhevm, path.join(process.cwd(), "my_funky_fhevm"));
    });
  });

  describe("HardhatConfig extension defaults", function () {
    useEnvironment("hardhat-default-project");

    it("fhevm path default value should be <root>/hh_fhevm", function () {
      console.log(this.hre.config.paths.fhevm);
      assert.equal(this.hre.config.paths.fhevm, path.join(process.cwd(), DEFAULT_CONFIG_PATH_FHEVM));
    });
  });
});
