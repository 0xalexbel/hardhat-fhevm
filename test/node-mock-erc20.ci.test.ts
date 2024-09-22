// tslint:disable-next-line no-implicit-dependencies
import { HardhatRuntimeEnvironment, JsonRpcServer } from "hardhat/types";
import { useEnvironment } from "./helpers";
import { TASK_NODE, TASK_NODE_SERVER_READY, TASK_TEST } from "hardhat/builtin-tasks/task-names";
import { expect } from "chai";

describe("mock tasks tests", function () {
  useEnvironment("node-mock-erc20");

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

  async function checkAddresses(hre: HardhatRuntimeEnvironment) {
    const [signer] = await hre.ethers.getSigners();
    // mnemonic= test test ... junk
    expect(signer.address).to.eq("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    // deployed using ZamaDev default mnemonic
    expect(hre.fhevm.readACLAddress()).to.eq("0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92");
  }

  async function test1(hre: HardhatRuntimeEnvironment) {
    hre.fhevm.logOptions = { quiet: true };
    // By default, when running standalone hardhat node, use on-chain mock
    expect(hre.network.config.useOnChainFhevmMockProcessor).is.eq(true);
    await hre.run(TASK_TEST);
    await checkAddresses(hre);
  }

  async function test2(hre: HardhatRuntimeEnvironment) {
    hre.fhevm.logOptions = { quiet: true };
    // By default, when running standalone hardhat node, use on-chain mock
    expect(hre.network.config.useOnChainFhevmMockProcessor).is.eq(true);
    hre.network.config.useOnChainFhevmMockProcessor = false;
    await hre.run(TASK_TEST);
    await checkAddresses(hre);
  }

  it("NodeMockERC201: TASK_TEST", async function () {
    runTest(this.hre, test1);
    await this.hre.run(TASK_NODE, { port: 8547 });
  });

  it("NodeMockERC202: TASK_TEST", async function () {
    runTest(this.hre, test2);
    await this.hre.run(TASK_NODE, { port: 8547 });
  });
});
