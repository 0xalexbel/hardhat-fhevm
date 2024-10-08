import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import assert from "assert";
import hre from "hardhat";
import { ethers } from "hardhat";
import type fhevmjs from "fhevmjs/node";

export interface Signers {
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
  dave: HardhatEthersSigner;
  eve: HardhatEthersSigner;
}

let signers: Signers;

export interface FhevmjsInstances {
  alice: fhevmjs.FhevmInstance;
  bob: fhevmjs.FhevmInstance;
  carol: fhevmjs.FhevmInstance;
  dave: fhevmjs.FhevmInstance;
  eve: fhevmjs.FhevmInstance;
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

export const createInstances = async (accounts: Signers): Promise<FhevmjsInstances> => {
  const instances: FhevmjsInstances = {} as FhevmjsInstances;
  await Promise.all(
    Object.keys(accounts).map(async (k) => {
      instances[k as keyof FhevmjsInstances] = await hre.fhevm.createInstance();
    }),
  );
  return instances;
};
