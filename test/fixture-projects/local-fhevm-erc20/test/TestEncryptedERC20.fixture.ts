import hre from "hardhat";

//import type { EncryptedERC20 } from "../../../types";
import { getSigners } from "./test_utils";
import { ethers } from "ethers";

export async function deployEncryptedERC20Fixture(): Promise<ethers.Contract> {
  const signers = getSigners();

  const artifact = await hre.artifacts.readArtifact("EncryptedERC20");
  const contractFactory = await hre.ethers.getContractFactoryFromArtifact(artifact, signers.alice);
  const contract = await contractFactory.connect(signers.alice).deploy("Naraggara", "NARA"); // City of Zama's battle
  await contract.waitForDeployment();

  return contract;
}
