import hre from "hardhat";

import { getSigners } from "./test_utils";
import { ethers } from "ethers";
import { isDeployed } from "../../../../src/utils";

export async function deployEncryptedERC20Fixture(existingAddress?: string): Promise<ethers.Contract> {
  const artifact = await hre.artifacts.readArtifact("EncryptedERC20");
  const signers = getSigners();
  const contractFactory = await hre.ethers.getContractFactoryFromArtifact(artifact, signers.alice);

  if (existingAddress !== undefined) {
    if (await isDeployed(existingAddress, hre.ethers.provider)) {
      return contractFactory.attach(existingAddress).connect(hre.ethers.provider) as ethers.Contract;
    } else {
      throw new Error("ERROR");
    }
  }

  const contract = await contractFactory.connect(signers.alice).deploy("Naraggara", "NARA"); // City of Zama's battle
  await contract.waitForDeployment();

  return contract;
}
