import { toBigIntLE, toBufferLE } from "bigint-buffer";
import assert from "assert";
import { ethers as EthersT } from "ethers";
import { HardhatFhevmError } from "../../error";
import { Artifacts, EthereumProvider } from "hardhat/types";
import { HardhatFhevmEthers } from "../types";

/**
 * Returns `true` is `address` is deployed, `false` otherwise
 */
export async function isDeployed(address: string | undefined, provider: EthersT.Provider | null | undefined) {
  const addr = await getDeployedAddress(address, provider);
  return addr !== undefined;
}

/**
 * Returns `address` if `address` is deployed, `undefined` otherwise
 */
export async function getDeployedAddress(
  address: string | undefined,
  provider: EthersT.Provider | null | undefined,
): Promise<string | undefined> {
  if (!provider) {
    return undefined;
  }
  if (!address) {
    return undefined;
  }
  try {
    if ((await provider.getCode(address)) !== "0x") {
      return address;
    }
    return undefined;
  } catch {
    // no network connection ?
    return undefined;
  }
}

/**
 * Returns the deployed byte code at `address`, or `undefined` if no byte code can found.
 */
export async function getDeployedByteCode(
  address: string | undefined,
  provider: EthersT.Provider | null | undefined,
): Promise<string | undefined> {
  if (!address) {
    return undefined;
  }
  if (!provider) {
    return undefined;
  }
  try {
    const bc = await provider.getCode(address);
    if (bc === "0x") {
      return undefined;
    }
    return bc;
  } catch {
    // no network connection ?
    return undefined;
  }
}

export async function getContractOwner(contract: string | EthersT.Addressable, runner: EthersT.ContractRunner) {
  const abi = [
    {
      inputs: [],
      name: "owner",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ];

  const c = new EthersT.Contract(contract, abi, runner);
  try {
    return (await c.owner()) as string;
  } catch {
    return undefined;
  }
}

// hre needed
export async function deployContract(
  fullyQualifiedName: string,
  /* eslint-disable  @typescript-eslint/no-explicit-any */
  args: any[],
  deployer: EthersT.HDNodeWallet,
  heth: HardhatFhevmEthers,
) {
  try {
    const artifact = await heth.artifacts.readArtifact(fullyQualifiedName);
    const factory = await heth.ethers.getContractFactoryFromArtifact(artifact, deployer);

    const contract = await factory.connect(deployer).deploy(...args);
    await contract.waitForDeployment();
    return contract;
  } catch (err) {
    throw new HardhatFhevmError(`Deploy contract ${fullyQualifiedName} failed (signer=${deployer.address}), ${err}`);
  }
}

export async function deployContractUsingSetCode(
  targetAddress: string,
  fullyQualifiedName: string,
  setCodeRpcMethod: string,
  provider: EthersT.Provider,
  ethProvider: EthereumProvider,
  artifacts: Artifacts,
) {
  const artifact = await artifacts.readArtifact(fullyQualifiedName);

  // Call setCode via HH EthereumProvider class
  await ethProvider.send(setCodeRpcMethod, [targetAddress, artifact.deployedBytecode]);

  const new_bc = await getDeployedByteCode(targetAddress, provider);
  if (new_bc !== artifact.deployedBytecode) {
    throw new HardhatFhevmError(`Deploy ${fullyQualifiedName} failed.`);
  }
}

export async function getAllPastTransactionHashes(fromBlockNumber: number, provider: EthersT.Provider) {
  const latestBlockNumber: number = await provider.getBlockNumber();
  const txHashes: [string, number][] = [];

  // Iterate through all blocks and collect transaction hashes
  for (let i = fromBlockNumber; i <= latestBlockNumber; i++) {
    const block = await provider.getBlock(i);
    block!.transactions.forEach((tx) => {
      txHashes.push([tx, i]);
    });
  }

  return txHashes;
}

export function splitFullyQualifiedName(fqn: string): { importPath: string; contractName: string } {
  const [_importPath, _contractName] = fqn.split(":");
  assert(_importPath);
  assert(_contractName);
  return {
    importPath: _importPath,
    contractName: _contractName,
  };
}

export function toBeHexNoPrefix(_value: EthersT.BigNumberish, _width?: EthersT.Numeric) {
  return EthersT.toBeHex(_value, _width).substring(2);
}

// function toBytes32Hex(_value: ethers.BigNumberish) {
//   return ethers.toBeHex(_value, 32);
// }

export function bytesToBigInt(byteArray: Uint8Array): bigint {
  if (!byteArray || byteArray?.length === 0) {
    return BigInt(0);
  }
  const buffer = Buffer.from(byteArray);
  const result = toBigIntLE(buffer);
  return result;
}

export const bigIntToBytes = (value: bigint) => {
  const byteArrayLength = Math.ceil(value.toString(2).length / 8);
  return new Uint8Array(toBufferLE(value, byteArrayLength));
};

export function hex64ToHex40(hex64: string): string {
  if (hex64.startsWith("0x")) {
    if (hex64.length <= 42) {
      const addr = "0x" + hex64.substring(2).padStart(40, "0");
      return EthersT.getAddress(addr);
    }
    assert(hex64.length === 66);
    assert(hex64.substring(0, hex64.length - 40) === "0x000000000000000000000000");
    return hex64.substring(hex64.length - 40);
  } else {
    assert(hex64.length === 64);
    assert(hex64.substring(0, hex64.length - 40) === "000000000000000000000000");
    return "0x" + hex64.substring(hex64.length - 40);
  }
}

export function getRandomBigInt(numBits: number): bigint {
  if (numBits <= 0) {
    throw new Error("Number of bits must be greater than 0");
  }
  const numBytes = Math.ceil(numBits / 8);
  const randomBytes = new Uint8Array(numBytes);
  crypto.getRandomValues(randomBytes);

  let randomBigInt = BigInt(0);
  for (let i = 0; i < numBytes; i++) {
    randomBigInt = (randomBigInt << BigInt(8)) | BigInt(randomBytes[i]);
  }
  // Mask with numBits set to 1
  const mask = (BigInt(1) << BigInt(numBits)) - BigInt(1);
  randomBigInt = randomBigInt & mask;
  return randomBigInt;
}
