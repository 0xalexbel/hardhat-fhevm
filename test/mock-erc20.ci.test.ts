// tslint:disable-next-line no-implicit-dependencies

import { expect } from "chai";
import { useEnvironment } from "./helpers";
import { TASK_TEST } from "hardhat/builtin-tasks/task-names";
import "../src/type-extensions";

describe("mock erc20 tests", function () {
  useEnvironment("hardhat-mock-erc20");

  it("Mock_ERC20: TASK_TEST", async function () {
    const [signer] = await this.hre.ethers.getSigners();
    // mnemonic= test test ... junk
    expect(signer.address).to.eq("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");

    // By default, when running on hardhat, use std mock
    expect(this.hre.network.config.mockFhevm).is.eq(true);
    expect(this.hre.network.config.useOnChainFhevmMockProcessor).is.eq(false);

    expect(await this.hre.fhevm.useMockOnChainDecryption()).is.eq(false);

    this.hre.fhevm.logOptions = { quiet: true };
    await this.hre.run(TASK_TEST);
    // deployed using ZamaDev default mnemonic
    expect(this.hre.fhevm.readACLAddress()).to.eq("0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92");
  });

  it("FastMock_ERC20: TASK_TEST", async function () {
    const [signer] = await this.hre.ethers.getSigners();
    // mnemonic= test test ... junk
    expect(signer.address).to.eq("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");

    // By default, when running on hardhat, use std mock
    expect(this.hre.network.config.mockFhevm).is.eq(true);
    expect(this.hre.network.config.useOnChainFhevmMockProcessor).is.eq(false);

    this.hre.network.config.useOnChainFhevmMockProcessor = true;
    expect(await this.hre.fhevm.useMockOnChainDecryption()).is.eq(true);

    this.hre.fhevm.logOptions = { quiet: true };
    await this.hre.run(TASK_TEST);
    // deployed using ZamaDev default mnemonic (differs from 'test ... junk')
    expect(this.hre.fhevm.readACLAddress()).to.eq("0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92");
  });
});
