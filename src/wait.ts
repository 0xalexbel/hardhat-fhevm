import assert from "assert";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { HardhatFhevmRuntimeEnvironmentType } from "./common/HardhatFhevmRuntimeEnvironment";

export async function waitNBlocks(nBlocks: number, hre: HardhatRuntimeEnvironment) {
  if (nBlocks <= 0) {
    assert(nBlocks === 0, `nBlocks=${nBlocks}`);
    return;
  }

  let blockCount = 0;
  const provider = hre.ethers.provider;
  return new Promise((resolve, reject) => {
    const onBlock = async (newBlockNumber: number) => {
      blockCount++;
      if (blockCount >= nBlocks) {
        await provider.off("block", onBlock);
        resolve(newBlockNumber);
      }
    };

    provider.on("block", onBlock).catch((err) => {
      reject(err);
    });

    if (hre.fhevm.runtimeType === HardhatFhevmRuntimeEnvironmentType.Mock) {
      _sendNDummyTransactions(nBlocks, hre);
    }
  });
}

async function _sendNDummyTransactions(blockCount: number, hre: HardhatRuntimeEnvironment) {
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
