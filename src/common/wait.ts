import assert from "assert";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export async function waitNBlocks(nBlocks: number, hre: HardhatRuntimeEnvironment) {
  assert(!hre.fhevm.isConfliting());
  assert(hre.fhevm.isUserRequested());

  if (nBlocks <= 0) {
    assert(nBlocks === 0, `nBlocks=${nBlocks}`);
    return;
  }

  let blockCount = 0;
  return new Promise((resolve, reject) => {
    const onBlock = async (newBlockNumber: number) => {
      blockCount++;
      if (blockCount >= nBlocks) {
        await hre.fhevm.hardhatProvider().off("block", onBlock);
        resolve(newBlockNumber);
      }
    };

    hre.fhevm
      .hardhatProvider()
      .on("block", onBlock)
      .catch((err) => {
        reject(err);
      });

    if (hre.fhevm.isMock()) {
      sendNDummyTransactions(nBlocks, hre);
    }
  });
}

async function sendNDummyTransactions(blockCount: number, hre: HardhatRuntimeEnvironment) {
  assert(hre.network.name === "hardhat");

  let counter = blockCount;
  while (counter > 0) {
    counter--;
    const [signer] = await hre.ethers.getSigners();
    const nullAddress = "0x0000000000000000000000000000000000000000";
    const tx = {
      to: nullAddress,
      value: 0n,
    };
    const receipt = await signer.sendTransaction(tx);
    await receipt.wait();
  }
}
