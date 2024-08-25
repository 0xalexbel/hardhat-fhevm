import hre from "hardhat";

import { getSigners } from "../../test_utils";
import { ethers } from "ethers";

export async function deployTestAsyncDecryptFixture(): Promise<ethers.Contract> {
  const signers = getSigners();

  const artifact = await hre.artifacts.readArtifact("TestAsyncDecrypt");
  const contractFactory = await hre.ethers.getContractFactoryFromArtifact(artifact, signers.alice);
  const contract = await contractFactory.connect(signers.alice).deploy();
  await contract.waitForDeployment();

  return contract;
}
