import { ethers as EthersT } from "ethers";

import { toBeHexNoPrefix } from "../utils";

export const FHEVM_HANDLE_VERSION = 0;

export enum FhevmType {
  ebool = 0,
  euint4, //1
  euint8, //2
  euint16, //3
  euint32, //4
  euint64, //5
  euint128, //6
  eaddress, //7
  euint256, //8
  ebytes64, //9
  ebytes128, //10
  ebytes256, //11
}

export const FhevmTypesBytesSize: Record<FhevmType, number> = {
  0: 1, //ebool
  1: 1, //euint4
  2: 1, //euint8
  3: 2, //euint16
  4: 4, //euint32
  5: 8, //euint64
  6: 16, //euint128
  7: 20, //eaddress
  8: 32, //euint256
  9: 64, //ebytes64
  10: 128, //ebytes128
  11: 256, //ebytes256
};

export const FhevmNumBitsType: Record<number, FhevmType> = {
  1: 0,
  4: 1,
  8: 2,
  16: 3,
  32: 4,
  64: 5,
  128: 6,
  160: 7,
  256: 8,
  512: 9,
  1024: 10,
  2048: 11,
};

export const FhevmTypeNumBits: Record<FhevmType, bigint> = {
  0: 1n, //ebool 2**1 = 2
  1: 4n, //euint4 2**4 = 0x10 = 0xF + 1
  2: 8n, //euint8 2**8 = 0xFF + 1
  3: 16n, //euint16 2**16 = 0xFFFF + 1
  4: 32n, //euint32 2**32 = 0xFFFFFFFF + 1
  5: 64n, //euint64 2**64 = 0xFFFFFFFFFFFFFFFF + 1
  6: 128n, //euint128 2**64 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF + 1
  7: 160n, //eaddress         0x000000000000000000000000000000000000005d
  //                          0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF + 1
  8: 256n, //euint256 2**256 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF + 1
  //                           0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000
  9: 512n, //ebytes64
  10: 1024n, //ebytes128
  11: 2048n, //ebytes256
};

export const FhevmClearTextSolidityType: Record<FhevmType, string> = {
  0: "bool", // ebool
  1: "uint8", // euint4
  2: "uint8", // euint8
  3: "uint16", // euint16
  4: "uint32", // euint32
  5: "uint64", // euint64
  6: "uint128", // euint128
  7: "address", // eaddress
  8: "bytes", // euint256
  9: "bytes", // ebytes64
  10: "bytes", // ebytes128
  11: "bytes", // ebytes256
};

export enum FhevmOperator {
  fheAdd = 0,
  fheSub,
  fheMul,
  fheDiv,
  fheRem,
  fheBitAnd,
  fheBitOr,
  fheBitXor,
  fheShl,
  fheShr,
  fheRotl,
  fheRotr,
  fheEq,
  fheNe,
  fheGe,
  fheGt,
  fheLe,
  fheLt,
  fheMin,
  fheMax,
  fheNeg,
  fheNot,
  verifyCiphertext,
  cast,
  trivialEncrypt,
  fheIfThenElse,
  fheRand,
  fheRandBounded,
}

export function getHandleFhevmType(handle: EthersT.BigNumberish): FhevmType {
  let t: number = -1;
  if (typeof handle === "string") {
    t = parseInt(handle.slice(-4, -2), 16);
  } else if (typeof handle === "bigint") {
    t = parseInt(handle.toString(16).slice(-4, -2), 16);
  }
  if (t < 0 || t > 11) {
    throw new Error(`Unknown fhevm type ${t}`);
  }
  return t as FhevmType;
}

export function encodeComputedFhevmHandle(
  operator: FhevmOperator,
  handleType: FhevmType,
  solidityTypes: ReadonlyArray<string>,
  values: (string | bigint | number)[],
) {
  const handleHex = EthersT.keccak256(EthersT.solidityPacked(["uint8", ...solidityTypes], [operator, ...values]));
  // Replace last 4 bytes with type and version
  return handleHex.slice(0, -4) + toBeHexNoPrefix(handleType, 1) + toBeHexNoPrefix(FHEVM_HANDLE_VERSION, 1);
}
