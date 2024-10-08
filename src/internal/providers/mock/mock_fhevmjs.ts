import assert from "assert";
import { toBufferBE } from "bigint-buffer";
import crypto from "crypto";
import { ethers as EthersT } from "ethers";
import fhevmjs from "fhevmjs/node";
import { Keccak } from "sha3";

import { FhevmNumBitsType, FhevmType, getHandleListType } from "../../utils/handle";
import { bytesToBigInt } from "../../utils/eth_utils";
import { MockFhevmProvider } from "./MockFhevmProvider";

// const createInstance = async (fhevmProvider: MockFhevmProvider, chainId: number) => {
//   const instance = await fhevmjs_node.createInstance({ chainId });
//   instance.reencrypt = reencryptRequestMocked(fhevmProvider, chainId);
//   instance.createEncryptedInput = createEncryptedInputMocked;
//   instance.getPublicKey = () => "0xFFAA44433";
//   return instance;
// };

// len = numBytes + 32
function createUintToUint8ArrayFunction(numBits: number) {
  const numBytes = Math.ceil(numBits / 8);
  return function (uint: number | bigint | boolean) {
    // uint64 numBytes = 8
    // 1337 = 0x539 = 0x00_00_00_00_00_00_00_00_05_39
    const buffer = toBufferBE(BigInt(uint), numBytes);
    //0x0500000000000005396f8139e3c83d6a600ca15172f4fe64582a21898d4e8d858daf676611dc277abc000000000000000000000000
    //0x05_<be uint64 8 bytes>_6f8139e3c83d6a60_0ca15172f4fe6458_2a21898d4e8d858d_af676611dc277abc_[000000000000000000000000]
    //0x<type euint64 = 5>_<be uint64 8 bytes>_<rand 32 bytes>_[000000000000000000000000]
    //0000000000000539

    // concatenate 32 random bytes at the end of buffer to simulate encryption noise
    const randomBytes = crypto.randomBytes(32);
    const combinedBuffer = Buffer.concat([buffer, randomBytes]);
    assert(combinedBuffer.length === 32 + numBytes);

    let byteBuffer;
    let totalBuffer;
    const padBuffer = numBytes <= 20 ? Buffer.alloc(20 - numBytes) : Buffer.alloc(0); // to fit it in an E160List
    assert(padBuffer.length + numBytes === 20 || padBuffer.length + numBytes === 256);

    switch (numBits) {
      case 1:
        byteBuffer = Buffer.from([FhevmType.ebool]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer, padBuffer]);
        assert(totalBuffer.length === 52 + 1 || totalBuffer.length === 1 + 32 + 256);
        break;
      case 4:
        byteBuffer = Buffer.from([FhevmType.euint4]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer, padBuffer]);
        assert(totalBuffer.length === 52 + 1);
        break;
      case 8:
        byteBuffer = Buffer.from([FhevmType.euint8]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer, padBuffer]);
        assert(totalBuffer.length === 52 + 1);
        break;
      case 16:
        byteBuffer = Buffer.from([FhevmType.euint16]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer, padBuffer]);
        assert(totalBuffer.length === 52 + 1);
        break;
      case 32:
        byteBuffer = Buffer.from([FhevmType.euint32]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer, padBuffer]);
        assert(totalBuffer.length === 52 + 1);
        break;
      case 64:
        byteBuffer = Buffer.from([FhevmType.euint64]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer, padBuffer]);
        assert(totalBuffer.length === 52 + 1);
        break;
      case 160:
        byteBuffer = Buffer.from([FhevmType.eaddress]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer]);
        assert(totalBuffer.length === 52 + 1);
        break;
      case 2048:
        byteBuffer = Buffer.from([FhevmType.ebytes256]);
        totalBuffer = Buffer.concat([byteBuffer, combinedBuffer]);
        assert(totalBuffer.length === 1 + 32 + 256);
        break;
      default:
        throw Error("Non-supported numBits");
    }

    return totalBuffer;
  };
}

export function reencryptRequestMocked(
  fhevmProvider: MockFhevmProvider,
  chainId: number,
  skipACLCheck: boolean,
): fhevmjs.FhevmInstance["reencrypt"] {
  return async (
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
      chainId,
      verifyingContract: contractAddress,
    };
    const types = {
      Reencrypt: [{ name: "publicKey", type: "bytes" }],
    };
    const value = {
      publicKey: `0x${publicKey}`,
    };
    const signerAddress = EthersT.verifyTypedData(domain, types, value, `0x${signature}`);
    const normalizedSignerAddress = EthersT.getAddress(signerAddress);
    const normalizedUserAddress = EthersT.getAddress(userAddress);
    if (normalizedSignerAddress !== normalizedUserAddress) {
      throw new Error("Invalid EIP-712 signature!");
    }

    if (!skipACLCheck) {
      await fhevmProvider.throwIfCanNotDecrypt(handle, contractAddress, userAddress);
    }

    const clearBn = await fhevmProvider.decryptMockHandle(handle, contractAddress, userAddress);
    return clearBn;
  };
}

export const createEncryptedInputMocked = (contractAddress: string, callerAddress: string) => {
  if (!EthersT.isAddress(contractAddress)) {
    throw new Error("Contract address is not a valid address.");
  }

  if (!EthersT.isAddress(callerAddress)) {
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
      if (!EthersT.isAddress(value)) {
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
      const listType = getHandleListType(bits);

      let encrypted = Buffer.alloc(0);

      switch (listType) {
        case 160: {
          bits.map((v, i) => {
            encrypted = Buffer.concat([encrypted, createUintToUint8ArrayFunction(v)(values[i])]);
          });
          assert(encrypted.length === 53 * bits.length);
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
