import assert from "assert";
import { toBigIntLE, toBufferLE } from "bigint-buffer";
import crypto from "crypto";
import { ethers as EthersT } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { HardhatFhevmError } from "./error";

export function toBeHexNoPrefix(_value: EthersT.BigNumberish, _width?: EthersT.Numeric) {
  return EthersT.toBeHex(_value, _width).substring(2);
}

// function toBytes32Hex(_value: ethers.BigNumberish) {
//   return ethers.toBeHex(_value, 32);
// }

export function bigIntToAddress(value: bigint): string {
  return "0x" + value.toString(16).padStart(40, "0");
}

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

export function currentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "numeric", second: "numeric" });
}

export function hex64ToHex40(hex64: string): string {
  if (hex64.startsWith("0x")) {
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

export function removePrefix(str: string, prefix: string): string {
  if (str.startsWith(prefix)) {
    return str.substring(prefix.length);
  } else {
    return str;
  }
}

export function applyTemplate(template: string, placeholders: [string, string][]) {
  return replaceStrings(
    template,
    placeholders.map(([t, v]) => [`{{${t}}}`, v]),
  );
  // let s = template;
  // for (let i = 0; i < placeholders.length; ++i) {
  //   const t = placeholders[i][0];
  //   const v = placeholders[i][1];
  //   s = s.replaceAll(`{{${t}}}`, v);
  // }
  // return s;
}

export function replaceStrings(str: string, searchAndReplaceValues: [string, string][]) {
  let s = str;
  for (let i = 0; i < searchAndReplaceValues.length; ++i) {
    const search = searchAndReplaceValues[i][0];
    const replace = searchAndReplaceValues[i][1];
    s = s.replaceAll(search, replace);
  }
  return s;
}

export async function sleep(time: number) {
  if (time === 0) {
    return;
  }
  return new Promise((resolve) => setTimeout(resolve, time));
}

export async function isDeployed(address: string | undefined, provider: EthersT.Provider): Promise<string | undefined> {
  if (!address) {
    return undefined;
  }
  try {
    if ((await provider.getCode(address)) !== "0x") {
      return address;
    }
    return undefined;
  } catch (e) {
    // no network connection ?
    return undefined;
  }
}

export async function getDeployedByteCode(
  address: string | undefined,
  provider: EthersT.Provider,
): Promise<string | undefined> {
  if (!address) {
    return undefined;
  }
  try {
    const bc = await provider.getCode(address);
    if (bc === "0x") {
      return undefined;
    }
    return bc;
  } catch (e) {
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
  hre: HardhatRuntimeEnvironment,
) {
  try {
    const artifact = await hre.artifacts.readArtifact(fullyQualifiedName);
    const factory = await hre.ethers.getContractFactoryFromArtifact(artifact, deployer);

    const contract = await factory.connect(deployer).deploy(...args);
    await contract.waitForDeployment();
    return contract;
  } catch (err) {
    throw new HardhatFhevmError(`Deploy contract ${fullyQualifiedName} failed (signer=${deployer.address}), ${err}`);
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
