import assert from "assert";
import { toBufferBE } from "bigint-buffer";
import crypto from "crypto";
import { ethers } from "ethers";
import fhevmjs_node from "fhevmjs/node";
import { Keccak } from "sha3";

import { getMockACL } from "../common/contracts";
import { FhevmNumBitsType, FhevmType } from "../common/handle";
import { bytesToBigInt } from "../common/utils";
import { MockFhevmRuntimeEnvironment } from "./MockFhevmRuntimeEnvironment";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const createInstance = async (hre: HardhatRuntimeEnvironment) => {
  assert(hre.fhevm.isMock());

  const instance = await fhevmjs_node.createInstance({
    chainId: hre.network.config.chainId,
  });
  instance.reencrypt = reencryptRequestMocked(hre);
  instance.createEncryptedInput = createEncryptedInputMocked;
  instance.getPublicKey = () => "0xFFAA44433";
  return instance;
};

function createUintToUint8ArrayFunction(numBits: number) {
  const numBytes = Math.ceil(numBits / 8);
  return function (uint: number | bigint | boolean) {
    const buffer = toBufferBE(BigInt(uint), numBytes);

    // concatenate 32 random bytes at the end of buffer to simulate encryption noise
    const randomBytes = crypto.randomBytes(32);
    const combinedBuffer = Buffer.concat([buffer, randomBytes]);

    let byteBuffer;
    let totalBuffer;
    const padBuffer = numBytes <= 20 ? Buffer.alloc(20 - numBytes) : Buffer.alloc(0); // to fit it in an E160List

    switch (numBits) {
      case 1:
        byteBuffer = Buffer.from([FhevmType.ebool]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer, padBuffer]);
        break;
      case 4:
        byteBuffer = Buffer.from([FhevmType.euint4]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer, padBuffer]);
        break;
      case 8:
        byteBuffer = Buffer.from([FhevmType.euint8]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer, padBuffer]);
        break;
      case 16:
        byteBuffer = Buffer.from([FhevmType.euint16]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer, padBuffer]);
        break;
      case 32:
        byteBuffer = Buffer.from([FhevmType.euint32]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer, padBuffer]);
        break;
      case 64:
        byteBuffer = Buffer.from([FhevmType.euint64]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer, padBuffer]);
        break;
      case 160:
        byteBuffer = Buffer.from([FhevmType.eaddress]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer]);
        break;
      case 2048:
        byteBuffer = Buffer.from([FhevmType.ebytes256]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer]);
        break;
      default:
        throw Error("Non-supported numBits");
    }

    return totalBuffer;
  };
}
const reencryptRequestMocked =
  (hre: HardhatRuntimeEnvironment) =>
  async (
    handle: bigint,
    _privateKey: string,
    publicKey: string,
    signature: string,
    contractAddress: string,
    userAddress: string,
  ) => {
    // Signature checking:
    const domain = {
      name: "Authorization token",
      version: "1",
      chainId: hre.network.config.chainId,
      verifyingContract: contractAddress,
    };
    const types = {
      Reencrypt: [{ name: "publicKey", type: "bytes" }],
    };
    const value = {
      publicKey: `0x${publicKey}`,
    };
    const signerAddress = ethers.verifyTypedData(domain, types, value, `0x${signature}`);
    const normalizedSignerAddress = ethers.getAddress(signerAddress);
    const normalizedUserAddress = ethers.getAddress(userAddress);
    if (normalizedSignerAddress !== normalizedUserAddress) {
      throw new Error("Invalid EIP-712 signature!");
    }

    // ACL checking
    const acl = await getMockACL(hre);
    const userAllowed = await acl.persistAllowed(handle, userAddress);
    const contractAllowed = await acl.persistAllowed(handle, contractAddress);
    const isAllowed = userAllowed && contractAllowed;
    if (!isAllowed) {
      throw new Error("User is not authorized to reencrypt this handle!");
    }

    const fhevm = MockFhevmRuntimeEnvironment.get(hre)!;
    await fhevm.waitForCoprocessing();
    return await fhevm.queryClearText(handle);
  };

const createEncryptedInputMocked = (contractAddress: string, callerAddress: string) => {
  if (!ethers.isAddress(contractAddress)) {
    throw new Error("Contract address is not a valid address.");
  }

  if (!ethers.isAddress(callerAddress)) {
    throw new Error("User address is not a valid address.");
  }

  const values: bigint[] = [];
  const bits: (keyof typeof FhevmNumBitsType)[] = [];
  return {
    addBool(value: boolean | number | bigint) {
      if (value == null) throw new Error("Missing value");
      if (typeof value !== "boolean" && typeof value !== "number" && typeof value !== "bigint")
        throw new Error("The value must be a boolean, a number or a bigint.");
      if ((typeof value !== "bigint" || typeof value !== "number") && Number(value) > 1)
        throw new Error("The value must be 1 or 0.");
      values.push(BigInt(value));
      bits.push(1);
      return this;
    },
    add4(value: number | bigint) {
      checkEncryptedValue(value, 4);
      values.push(BigInt(value));
      bits.push(4);
      return this;
    },
    add8(value: number | bigint) {
      checkEncryptedValue(value, 8);
      values.push(BigInt(value));
      bits.push(8);
      return this;
    },
    add16(value: number | bigint) {
      checkEncryptedValue(value, 16);
      values.push(BigInt(value));
      bits.push(16);
      return this;
    },
    add32(value: number | bigint) {
      checkEncryptedValue(value, 32);
      values.push(BigInt(value));
      bits.push(32);
      return this;
    },
    add64(value: number | bigint) {
      checkEncryptedValue(value, 64);
      values.push(BigInt(value));
      bits.push(64);
      return this;
    },
    add128(value: number | bigint) {
      checkEncryptedValue(value, 128);
      values.push(BigInt(value));
      bits.push(128);
      return this;
    },
    addAddress(value: string) {
      if (!ethers.isAddress(value)) {
        throw new Error("The value must be a valid address.");
      }
      values.push(BigInt(value));
      bits.push(160);
      return this;
    },
    addBytes256(value: Uint8Array) {
      const bigIntValue = bytesToBigInt(value);
      checkEncryptedValue(bigIntValue, 2048);
      values.push(bigIntValue);
      bits.push(2048);
      return this;
    },
    getValues() {
      return values;
    },
    getBits() {
      return bits;
    },
    resetValues() {
      values.length = 0;
      bits.length = 0;
      return this;
    },
    encrypt() {
      const listType = getListType(bits);

      let encrypted = Buffer.alloc(0);

      switch (listType) {
        case 160: {
          bits.map((v, i) => {
            encrypted = Buffer.concat([encrypted, createUintToUint8ArrayFunction(v)(values[i])]);
          });
          break;
        }
        case 2048: {
          encrypted = createUintToUint8ArrayFunction(2048)(values[0]);
          break;
        }
      }

      const inputProof = new Uint8Array(encrypted);
      const hash = new Keccak(256).update(Buffer.from(inputProof)).digest();

      const handles = bits.map((v, i) => {
        const dataWithIndex = new Uint8Array(hash.length + 1);
        dataWithIndex.set(hash, 0);
        dataWithIndex.set([i], hash.length);
        const finalHash = new Keccak(256).update(Buffer.from(dataWithIndex)).digest();
        const dataInput = new Uint8Array(32);
        dataInput.set(finalHash, 0);
        dataInput.set([i, FhevmNumBitsType[v], 0], 29);
        return dataInput;
      });
      return {
        handles,
        inputProof,
      };
    },
    async send() {
      return {
        handles: [] as Uint8Array[],
        inputProof: new Uint8Array(),
      };
    },
  };
};

const checkEncryptedValue = (value: number | bigint, bits: number) => {
  if (value == null) throw new Error("Missing value");
  let limit;
  if (bits >= 8) {
    limit = BigInt(`0x${new Array(bits / 8).fill(null).reduce((v) => `${v}ff`, "")}`);
  } else {
    limit = BigInt(2 ** bits - 1);
  }
  if (typeof value !== "number" && typeof value !== "bigint") throw new Error("Value must be a number or a bigint.");
  if (value > limit) {
    throw new Error(`The value exceeds the limit for ${bits}bits integer (${limit.toString()}).`);
  }
};

const getListType = (bits: (keyof typeof FhevmNumBitsType)[]) => {
  // We limit to 12 items because for now we are using FheUint160List
  if (bits.length > 12) {
    throw new Error("You can't pack more than 12 values.");
  }

  if (bits.reduce((total, v) => total + v, 0) > 2048) {
    throw new Error("Too many bits in provided values. Maximum is 2048.");
  }

  if (bits.some((v) => v === 2048)) {
    return 2048;
  } else {
    return 160;
  }
};

const fhevmjs_mock = {
  createInstance,
  createEncryptedInput: createEncryptedInputMocked,
};

export = fhevmjs_mock;
