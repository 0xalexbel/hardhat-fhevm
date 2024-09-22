import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import assert from "assert";
import hre from "hardhat";
import { ethers } from "hardhat";
import { HardhatFhevmInstance } from "../../../../src/index";
import { HardhatFhevmRuntimeEnvironmentType } from "../../../../src/common/HardhatFhevmRuntimeEnvironment";

export interface Signers {
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
  dave: HardhatEthersSigner;
  eve: HardhatEthersSigner;
}

let signers: Signers;

export interface HardhatFhevmInstances {
  alice: HardhatFhevmInstance;
  bob: HardhatFhevmInstance;
  carol: HardhatFhevmInstance;
  dave: HardhatFhevmInstance;
  eve: HardhatFhevmInstance;
}

export const initSigners = async (): Promise<Signers> => {
  if (!signers) {
    const eSigners = await ethers.getSigners();
    signers = {
      alice: eSigners[0],
      bob: eSigners[1],
      carol: eSigners[2],
      dave: eSigners[3],
      eve: eSigners[4],
    };
  }
  assert(signers !== undefined);
  return signers;
};

export const getSigners = (): Signers => {
  assert(signers !== undefined);
  return signers;
};

export const createInstances = async (accounts: Signers): Promise<HardhatFhevmInstances> => {
  const instances: HardhatFhevmInstances = {} as HardhatFhevmInstances;
  await Promise.all(
    Object.keys(accounts).map(async (k) => {
      instances[k as keyof HardhatFhevmInstances] = await hre.fhevm.createInstance();
    }),
  );
  return instances;
};

export async function waitNBlocks(nBlocks: number) {
  if (nBlocks <= 0) {
    return;
  }

  let blockCount = 0;
  return new Promise((resolve, reject) => {
    const onBlock = async (newBlockNumber: number) => {
      blockCount++;
      if (blockCount >= nBlocks) {
        await hre.ethers.provider.off("block", onBlock);
        resolve(newBlockNumber);
      }
    };

    hre.ethers.provider.on("block", onBlock).catch((err) => {
      reject(err);
    });

    if (hre.fhevm.runtimeType === HardhatFhevmRuntimeEnvironmentType.Mock) {
      sendNDummyTransactions(nBlocks);
    }
  });
}

async function sendNDummyTransactions(blockCount: number) {
  let counter = blockCount;
  while (counter >= 0) {
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
