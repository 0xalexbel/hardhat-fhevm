import assert from "assert";
import { ethers } from "ethers";
import { log2 } from "extra-bigint";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getUserPackageNodeModulesDir, getTFHEExecutorArtifact, readTFHEExecutorAddress } from "../common/contracts";
import {
  FhevmOperator,
  FhevmType,
  FhevmTypeNumBits,
  FhevmTypesBytesSize,
  encodeComputedFhevmHandle,
  getHandleFhevmType,
} from "../common/handle";
import { getRandomBigInt, hex64ToHex40 } from "../common/utils";
import { HandleDB } from "./HandleDB";

///////////////////////////////////////////////////////////////////////////////

interface EvmState {
  stack: string[];
  memory: string[];
}

export class MockFhevmCoProcessor {
  private hre: HardhatRuntimeEnvironment & { __SOLIDITY_COVERAGE_RUNNING?: boolean };
  private lastBlockSnapshot: number;
  private lastCounterRandom: number;
  private counterRandom: number;
  private firstBlockListening: number;
  private handle_db: HandleDB;
  private tfheExecutorAddress: string;
  private tfheExecutorInterface: ethers.Interface | undefined;
  private tfheExecutorFunctionSelectorToSignature: Readonly<Record<string, string>> | undefined;

  constructor(hre: HardhatRuntimeEnvironment & { __SOLIDITY_COVERAGE_RUNNING?: boolean }) {
    this.hre = hre;
    if (hre.network.name !== "hardhat") {
      throw new Error("HHFhevmCoProcessor only runs on hardhat network");
    }
    this.lastBlockSnapshot = 0;
    this.lastCounterRandom = 0;
    this.firstBlockListening = 0;
    this.counterRandom = 0;
    this.handle_db = new HandleDB();
    this.tfheExecutorAddress = readTFHEExecutorAddress(getUserPackageNodeModulesDir(this.hre.config));
  }

  public async init() {
    await this.handle_db.init();
  }

  private TFHEExecutorInterface() {
    if (!this.tfheExecutorInterface) {
      this.tfheExecutorInterface = new ethers.Interface(getTFHEExecutorArtifact(this.hre).abi);
    }
    return this.tfheExecutorInterface;
  }

  private TFHEExecutorFuncs() {
    if (!this.tfheExecutorFunctionSelectorToSignature) {
      const functions = this.TFHEExecutorInterface()
        .fragments.filter((fragment) => fragment instanceof ethers.FunctionFragment)
        .map((fragment) => fragment as ethers.FunctionFragment);

      this.tfheExecutorFunctionSelectorToSignature = functions.reduce((acc: Record<string, string>, func) => {
        const funcSignature = `${func.name}(${func.inputs.map((input) => input.type).join(",")})`;
        acc[func.selector] = funcSignature;
        return acc;
      }, {});
    }
    return this.tfheExecutorFunctionSelectorToSignature;
  }

  public handleDB() {
    return this.handle_db;
  }

  public async wait(): Promise<void> {
    const pastTxHashes = await this.getAllPastTransactionHashes();
    for (const txHash of pastTxHashes) {
      const hash = txHash[0];
      //const blockNumber = txHash[1];

      const trace = await this.hre.fhevm.hardhatProvider().send("debug_traceTransaction", [hash]);
      if (!trace.failed) {
        /*
async function processLogs(trace, validSubcallsIndexes) {
  for (const obj of trace.structLogs
    .map((value, index) => ({ value, index }))
    .filter((obj) => obj.value.op === "CALL")) {
    await insertHandle(obj, validSubcallsIndexes);
  }
}
        */
        //await processLogs(trace, blockNumber);
        for (const obj of trace.structLogs.filter((obj: { op: string }) => obj.op === "CALL")) {
          const state = obj! as EvmState;
          const contractAddress = state.stack.at(-2);
          if (!contractAddress) {
            continue;
          }
          // Not a CALL on the coprocessor
          if (hex64ToHex40(contractAddress).toLowerCase() !== this.tfheExecutorAddress.toLowerCase()) {
            continue;
          }

          const argsOffset = Number(`0x${state.stack.at(-4)}`);
          const argsSize = Number(`0x${state.stack.at(-5)}`);
          const calldata = this.extractCalldata(state.memory, argsOffset, argsSize);

          const currentSelector = "0x" + calldata.slice(0, 8);
          const decodedData = this.TFHEExecutorInterface().decodeFunctionData(currentSelector, "0x" + calldata);

          const funcSignature = this.TFHEExecutorFuncs()[currentSelector];

          const { handleHex, clearText, replace } = await this.computeNewHandle(funcSignature, decodedData);

          this.handleDB().insert(handleHex, clearText, replace);
        }
      }
    }
  }

  private async computeNewHandle(
    funcSignature: string,
    funcArgs: ethers.Result,
  ): Promise<{ handleHex: string; clearText: bigint; replace: boolean }> {
    let handleHex: string = "";
    let clearText: bigint = BigInt(0);
    let replace: boolean = false;

    switch (funcSignature) {
      case "trivialEncrypt(uint256,bytes1)": {
        assert(typeof funcArgs[0] === "bigint");
        assert(typeof funcArgs[1] === "string");
        const handleType = Number(funcArgs[1]) as FhevmType;
        handleHex = encodeComputedFhevmHandle(
          FhevmOperator.trivialEncrypt,
          handleType,
          ["uint256", "bytes1"],
          funcArgs,
        );
        clearText = funcArgs[0];
        break;
      }
      case "fheAdd(uint256,uint256,bytes1)": {
        const op = await this.binaryOp(FhevmOperator.fheAdd, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS + op.clearRHS;
        clearText = clearText % 2n ** FhevmTypeNumBits[op.handleType];
        break;
      }
      case "fheSub(uint256,uint256,bytes1)": {
        const op = await this.binaryOp(FhevmOperator.fheSub, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS - op.clearRHS;
        clearText = clearText % 2n ** FhevmTypeNumBits[op.handleType];
        break;
      }
      case "fheMul(uint256,uint256,bytes1)": {
        const op = await this.binaryOp(FhevmOperator.fheMul, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS * op.clearRHS;
        clearText = clearText % 2n ** FhevmTypeNumBits[op.handleType];
        break;
      }
      case "fheDiv(uint256,uint256,bytes1)": {
        const op = await this.binaryOp(FhevmOperator.fheDiv, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS / op.clearRHS;
        clearText = clearText % 2n ** FhevmTypeNumBits[op.handleType];
        break;
      }
      case "fheRem(uint256,uint256,bytes1)": {
        const op = await this.binaryOp(FhevmOperator.fheRem, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS % op.clearRHS;
        clearText = clearText % 2n ** FhevmTypeNumBits[op.handleType];
        break;
      }
      case "fheBitAnd(uint256,uint256,bytes1)": {
        const op = await this.binaryOp(FhevmOperator.fheBitAnd, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS & op.clearRHS;
        clearText = clearText % 2n ** FhevmTypeNumBits[op.handleType];
        break;
      }
      case "fheBitOr(uint256,uint256,bytes1)": {
        const op = await this.binaryOp(FhevmOperator.fheBitOr, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS | op.clearRHS;
        clearText = clearText % 2n ** FhevmTypeNumBits[op.handleType];
        break;
      }
      case "fheBitXor(uint256,uint256,bytes1)": {
        const op = await this.binaryOp(FhevmOperator.fheBitXor, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS ^ op.clearRHS;
        clearText = clearText % 2n ** FhevmTypeNumBits[op.handleType];
        break;
      }
      case "fheShl(uint256,uint256,bytes1)": {
        const op = await this.binaryOp(FhevmOperator.fheShl, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS << op.clearRHS % FhevmTypeNumBits[op.handleType];
        clearText = clearText % 2n ** FhevmTypeNumBits[op.handleType];
        break;
      }
      case "fheShr(uint256,uint256,bytes1)": {
        const op = await this.binaryOp(FhevmOperator.fheShr, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS >> op.clearRHS % FhevmTypeNumBits[op.handleType];
        clearText = clearText % 2n ** FhevmTypeNumBits[op.handleType];
        break;
      }
      case "fheRotl(uint256,uint256,bytes1)": {
        const op = await this.binaryOp(FhevmOperator.fheRotl, funcArgs);
        handleHex = op.handleHex;
        const shift = op.clearRHS % FhevmTypeNumBits[op.handleType];
        clearText = (op.clearLHS << shift) | (op.clearLHS >> (FhevmTypeNumBits[op.handleType] - shift));
        clearText = clearText % 2n ** FhevmTypeNumBits[op.handleType];
        break;
      }
      case "fheRotr(uint256,uint256,bytes1)": {
        const op = await this.binaryOp(FhevmOperator.fheRotr, funcArgs);
        handleHex = op.handleHex;
        const shift = op.clearRHS % FhevmTypeNumBits[op.handleType];
        clearText = (op.clearLHS >> shift) | (op.clearLHS << (FhevmTypeNumBits[op.handleType] - shift));
        clearText = clearText % 2n ** FhevmTypeNumBits[op.handleType];
        break;
      }
      case "fheEq(uint256,uint256,bytes1)": {
        const op = await this.boolBinaryOp(FhevmOperator.fheEq, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS === op.clearRHS ? 1n : 0n;
        break;
      }
      case "fheNe(uint256,uint256,bytes1)": {
        const op = await this.boolBinaryOp(FhevmOperator.fheNe, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS !== op.clearRHS ? 1n : 0n;
        break;
      }
      case "fheGe(uint256,uint256,bytes1)": {
        const op = await this.boolBinaryOp(FhevmOperator.fheGe, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS >= op.clearRHS ? 1n : 0n;
        break;
      }
      case "fheGt(uint256,uint256,bytes1)": {
        const op = await this.boolBinaryOp(FhevmOperator.fheGt, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS > op.clearRHS ? 1n : 0n;
        break;
      }
      case "fheLe(uint256,uint256,bytes1)": {
        const op = await this.boolBinaryOp(FhevmOperator.fheLe, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS <= op.clearRHS ? 1n : 0n;
        break;
      }
      case "fheLt(uint256,uint256,bytes1)": {
        const op = await this.boolBinaryOp(FhevmOperator.fheLt, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS < op.clearRHS ? 1n : 0n;
        break;
      }
      case "fheMax(uint256,uint256,bytes1)": {
        const op = await this.binaryOp(FhevmOperator.fheMax, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS > op.clearRHS ? op.clearLHS : op.clearRHS;
        break;
      }
      case "fheMin(uint256,uint256,bytes1)": {
        const op = await this.binaryOp(FhevmOperator.fheMin, funcArgs);
        handleHex = op.handleHex;
        clearText = op.clearLHS < op.clearRHS ? op.clearLHS : op.clearRHS;
        break;
      }
      case "cast(uint256,bytes1)": {
        assert(typeof funcArgs[0] === "bigint");
        assert(typeof funcArgs[1] === "string");
        const handleType = parseInt(funcArgs[1]) as FhevmType;
        handleHex = encodeComputedFhevmHandle(FhevmOperator.cast, handleType, ["uint256", "bytes1"], funcArgs);

        const clearLHS = await this.handle_db.queryClearTextFromBigInt(funcArgs[0]);
        clearText = clearLHS % 2n ** FhevmTypeNumBits[handleType];
        break;
      }
      case "fheNot(uint256)": {
        const op = await this.unaryOp(FhevmOperator.fheNot, funcArgs);
        handleHex = op.handleHex;
        const numBits = FhevmTypeNumBits[op.handleType];

        // Create the mask with numBits bits set to 1
        const BIT_MASK = (BigInt(1) << numBits) - BigInt(1);
        clearText = ~op.clearLHS & BIT_MASK;
        break;
      }
      case "fheNeg(uint256)": {
        const op = await this.unaryOp(FhevmOperator.fheNeg, funcArgs);
        handleHex = op.handleHex;
        const numBits = FhevmTypeNumBits[op.handleType];

        // Create the mask with numBits bits set to 1
        const BIT_MASK = (BigInt(1) << numBits) - BigInt(1);
        clearText = ~op.clearLHS & BIT_MASK;
        clearText = (clearText + 1n) % 2n ** numBits;
        break;
      }
      case "verifyCiphertext(bytes32,address,bytes,bytes1)": {
        assert(typeof funcArgs[0] === "string");
        assert(typeof funcArgs[1] === "string");
        assert(typeof funcArgs[2] === "string");
        assert(typeof funcArgs[3] === "string");

        handleHex = funcArgs[0];
        const inputProof = funcArgs[2].replace(/^0x/, "");
        const handleType = getHandleFhevmType(handleHex);
        if (handleType !== FhevmType.ebytes256) {
          //not an ebytes256
          const numBytes = FhevmTypesBytesSize[handleType];
          const idx = parseInt(handleHex.slice(-6, -4), 16);
          clearText = BigInt("0x" + inputProof.slice(2 + 2 * 53 * idx, 2 + 2 * numBytes + 2 * 53 * idx));
        } else {
          clearText = BigInt("0x" + inputProof.slice(2, 2 + 2 * 256));
        }
        break;
      }
      case "fheIfThenElse(uint256,uint256,uint256)": {
        assert(typeof funcArgs[0] === "bigint");
        assert(typeof funcArgs[1] === "bigint");
        assert(typeof funcArgs[2] === "bigint");

        const controlHandle = funcArgs[0];
        const trueHandle = funcArgs[1];
        const falseHandle = funcArgs[2];

        const trueType = getHandleFhevmType(trueHandle);
        const falseType = getHandleFhevmType(falseHandle);

        const clearControl = await this.handle_db.queryClearTextFromBigInt(controlHandle);
        const clearTrue = await this.handle_db.queryClearTextFromBigInt(trueHandle);
        const clearFalse = await this.handle_db.queryClearTextFromBigInt(falseHandle);

        if (clearControl === 1n) {
          clearText = clearTrue;
          handleHex = encodeComputedFhevmHandle(
            FhevmOperator.fheIfThenElse,
            trueType,
            ["uint256", "uint256", "uint256"],
            funcArgs,
          );
        } else {
          clearText = clearFalse;
          handleHex = encodeComputedFhevmHandle(
            FhevmOperator.fheIfThenElse,
            falseType,
            ["uint256", "uint256", "uint256"],
            funcArgs,
          );
        }
        break;
      }
      case "fheRand(bytes1)": {
        assert(typeof funcArgs[0] === "string");

        const handleType = parseInt(funcArgs[0], 16) as FhevmType;
        handleHex = encodeComputedFhevmHandle(
          FhevmOperator.fheRand,
          handleType,
          ["bytes1", "uint256"],
          [funcArgs[0], this.counterRandom],
        );

        const numBits = Number(FhevmTypeNumBits[handleType]);
        clearText = getRandomBigInt(numBits);

        this.counterRandom++;
        replace = true;
        break;
      }
      case "fheRandBounded(uint256,bytes1)": {
        assert(typeof funcArgs[0] === "bigint");
        assert(typeof funcArgs[1] === "string");

        const handleType = parseInt(funcArgs[1], 16) as FhevmType;
        handleHex = encodeComputedFhevmHandle(
          FhevmOperator.fheRandBounded,
          handleType,
          ["uint256", "bytes1", "uint256"],
          [funcArgs[0], funcArgs[1], this.counterRandom],
        );

        clearText = getRandomBigInt(Number(log2(funcArgs[0])));

        this.counterRandom++;
        replace = true;
        break;
      }
    }
    return {
      handleHex,
      clearText,
      replace,
    };
  }

  private async binaryOp(op: FhevmOperator, args: ethers.Result) {
    assert(typeof args[0] === "bigint");
    assert(typeof args[1] === "bigint");
    assert(typeof args[2] === "string");

    const lhsHandle = args[0];
    const rhsHandle = args[1];
    const rhsIsClear = args[2] === "0x01";

    const handleType = getHandleFhevmType(lhsHandle);
    const handleHex = encodeComputedFhevmHandle(op, handleType, ["uint256", "uint256", "bytes1"], args);

    const clearLHS = await this.handle_db.queryClearTextFromBigInt(lhsHandle);
    const clearRHS = rhsIsClear ? rhsHandle : await this.handle_db.queryClearTextFromBigInt(rhsHandle);

    return {
      handleHex,
      handleType,
      clearLHS,
      clearRHS,
    };
  }

  private async boolBinaryOp(op: FhevmOperator, args: ethers.Result) {
    assert(typeof args[0] === "bigint");
    assert(typeof args[1] === "bigint");
    assert(typeof args[2] === "string");

    const lhsHandle = args[0];
    const rhsHandle = args[1];
    const rhsIsClear = args[2] === "0x01";

    const handleType = FhevmType.ebool;
    const handleHex = encodeComputedFhevmHandle(op, handleType, ["uint256", "uint256", "bytes1"], args);

    const clearLHS = await this.handle_db.queryClearTextFromBigInt(lhsHandle);
    const clearRHS = rhsIsClear ? rhsHandle : await this.handle_db.queryClearTextFromBigInt(rhsHandle);

    return {
      handleHex,
      handleType,
      clearLHS,
      clearRHS,
    };
  }

  private async unaryOp(op: FhevmOperator, args: ethers.Result) {
    assert(typeof args[0] === "bigint");

    const lhsHandle = args[0];

    const handleType = getHandleFhevmType(lhsHandle);
    const handleHex = encodeComputedFhevmHandle(op, handleType, ["uint256"], args);

    const clearLHS = await this.handle_db.queryClearTextFromBigInt(lhsHandle);

    return {
      handleHex,
      handleType,
      clearLHS,
    };
  }

  private extractCalldata(memory: string[], offset: number, size: number): string {
    const startIndex = Math.floor(offset / 32);
    const endIndex = Math.ceil((offset + size) / 32);
    const memorySegments = memory.slice(startIndex, endIndex);
    let calldata = "";
    for (let i = 0; i < memorySegments.length; i++) {
      calldata += memorySegments[i];
    }
    const calldataStart = (offset % 32) * 2;
    const calldataEnd = calldataStart + size * 2;
    return calldata.slice(calldataStart, calldataEnd);
  }

  private async updateLastBlockSnapshot() {
    const res = await this.hre.fhevm.hardhatProvider().send("get_lastBlockSnapshot");
    assert(typeof res[0] === "number");
    assert(typeof res[1] === "number");
    this.lastBlockSnapshot = res[0];
    this.lastCounterRandom = res[1];
  }

  private async getAllPastTransactionHashes() {
    const provider = this.hre.fhevm.hardhatProvider();
    const latestBlockNumber = await provider.getBlockNumber();
    const txHashes: [string, number][] = [];

    if (this.hre.__SOLIDITY_COVERAGE_RUNNING !== true) {
      // evm_snapshot is not supported in coverage mode
      await this.updateLastBlockSnapshot();
      if (this.lastBlockSnapshot < this.firstBlockListening) {
        this.firstBlockListening = this.lastBlockSnapshot + 1;
        this.counterRandom = this.lastCounterRandom;
      }
    }

    // Iterate through all blocks and collect transaction hashes
    for (let i = this.firstBlockListening; i <= latestBlockNumber; i++) {
      const block = await provider.getBlock(i);
      block!.transactions.forEach((tx) => {
        txHashes.push([tx, i]);
      });
    }

    /*
  for (let i = firstBlockListening; i <= latestBlockNumber; i++) {
    const block = await provider.getBlock(i, true);
    block!.transactions.forEach((tx, index) => {
      const rcpt = block?.prefetchedTransactions[index];
      txHashes.push([tx, { to: rcpt.to, status: rcpt.status }]);
    });
  } */

    this.firstBlockListening = latestBlockNumber + 1;

    if (this.hre.__SOLIDITY_COVERAGE_RUNNING !== true) {
      // evm_snapshot is not supported in coverage mode
      await provider.send("set_lastBlockSnapshot", [this.firstBlockListening]);
    }
    return txHashes;
  }

  // async function buildCallTree(trace, receipt) {
  //   const structLogs = trace.structLogs;

  //   const callStack = [];
  //   const callTree = {
  //     id: 0,
  //     type: receipt.to ? "TOPCALL" : "TOPCREATE",
  //     revert: receipt.status === 1 ? false : true,
  //     to: receipt.to ? receipt.to : null,
  //     calls: [],
  //     indexTrace: 0,
  //   };
  //   let currentNode = callTree;
  //   const lenStructLogs = structLogs.length;
  //   let index = 1;
  //   for (const [i, log] of structLogs.entries()) {
  //     if (i < lenStructLogs - 1) {
  //       if (structLogs[i].depth - structLogs[i + 1].depth === 1) {
  //         if (!["RETURN", "SELFDESTRUCT", "STOP", "REVERT", "INVALID"].includes(structLogs[i].op)) {
  //           currentNode.outofgasOrOther = true;
  //           currentNode = callStack.pop();
  //         }
  //       }
  //     }

  //     switch (log.op) {
  //       case "CALL":
  //       case "DELEGATECALL":
  //       case "CALLCODE":
  //       case "STATICCALL":
  //       case "CREATE":
  //       case "CREATE2":
  //         if (i < lenStructLogs - 1) {
  //           if (structLogs[i + 1].depth - structLogs[i].depth === 1) {
  //             const newNode = {
  //               id: index,
  //               type: log.op,
  //               to: log.stack[log.stack.length - 2],
  //               calls: [],
  //               revert: true,
  //               outofgasOrOther: false,
  //               indexTrace: i,
  //             };
  //             currentNode.calls.push(newNode);
  //             callStack.push(currentNode);
  //             currentNode = newNode;
  //             index += 1;
  //           }
  //         }
  //         break;
  //       case "RETURN": // some edge case probably not handled well : if memory expansion cost on RETURN exceeds the remaining gas in current subcall, but it's OK for a mocked mode
  //       case "SELFDESTRUCT": // some edge case probably not handled well : if there is not enough gas remaining on SELFDESTRUCT, but it's OK for a mocked mode
  //       case "STOP":
  //         currentNode.revert = false;
  //         currentNode = callStack.pop();
  //         break;
  //       case "REVERT":
  //       case "INVALID":
  //         currentNode = callStack.pop();
  //         break;
  //     }

  //     switch (log.op) {
  //       case "CREATE":
  //       case "CREATE2":
  //         currentNode.to = null;
  //         break;
  //     }
  //   }
  //   return callTree;
  // }

  // export const awaitCoprocessor = async (): Promise<void> => {
  //   const pastTxHashes = await getAllPastTransactionHashes();
  //   for (const txHash of pastTxHashes) {
  //     const trace = await ethers.provider.send("debug_traceTransaction", [txHash[0]]);

  //     if (!trace.failed) {
  //       const callTree = await buildCallTree(trace, txHash[1]);
  //       const validSubcallsIndexes = getValidSubcallsIds(callTree)[1];
  //       await processLogs(trace, validSubcallsIndexes);
  //     }
  //   }
  // };

  // getValidSubcallsIds(tree) {
  //   const result = [];
  //   const resultIndexes = [];

  //   function traverse(node, ancestorReverted) {
  //     if (ancestorReverted || node.revert) {
  //       ancestorReverted = true;
  //     } else {
  //       result.push(node.id);
  //       resultIndexes.push(node.indexTrace);
  //     }
  //     for (const child of node.calls) {
  //       traverse(child, ancestorReverted);
  //     }
  //   }

  //   traverse(tree, false);

  //   return [result, resultIndexes];
  // }
}
