import assert from "assert";
import { toBigIntLE, toBufferLE } from "bigint-buffer";
import crypto from "crypto";
import { ethers } from "ethers";

export function toBeHexNoPrefix(_value: ethers.BigNumberish, _width?: ethers.Numeric) {
  return ethers.toBeHex(_value, _width).substring(2);
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
