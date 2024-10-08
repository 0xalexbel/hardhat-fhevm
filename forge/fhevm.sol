// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";
import {console} from "forge-std/console.sol";

import {ACL} from "fhevm/lib/ACL.sol";
import {TFHEExecutor, EXT_TFHE_LIBRARY} from "fhevm/lib/TFHEExecutor.sol";
import {TFHEExecutorDB} from "fhevm/lib/TFHEExecutorDB.sol";
import {KMSVerifier} from "fhevm/lib/KMSVerifier.sol";
import {GatewayContract} from "fhevm/gateway/GatewayContract.sol";
import {MockedPrecompile} from "fhevm/lib/MockedPrecompile.sol";
import {TFHE, ebool, euint8, euint64, einput, Common} from "fhevm/lib/TFHE.sol";

import {fhevmCoprocessorAdd} from "fhevm/lib/FHEVMCoprocessorAddress.sol";
import {aclAdd} from "fhevm/lib/ACLAddress.sol";
import {KMS_VERIFIER_CONTRACT_ADDRESS} from "fhevm/lib/KMSVerifierAddress.sol";
import {GATEWAY_CONTRACT_PREDEPLOY_ADDRESS} from "fhevm/gateway/lib/PredeployAddress.sol";

enum ArithmeticCheckingMode {
    Operands,
    OperandsAndResult
}

library fhevm {
    uint16 internal constant ebool_size_t = 1;
    uint16 internal constant euint4_size_t = 1;
    uint16 internal constant euint8_size_t = 1;
    uint16 internal constant euint16_size_t = 2;
    uint16 internal constant euint32_size_t = 4;
    uint16 internal constant euint64_size_t = 8;
    uint16 internal constant euint128_size_t = 16;
    uint16 internal constant eaddress_size_t = 20;
    uint16 internal constant euint256_size_t = 32;
    uint16 internal constant ebytes64_size_t = 64;
    uint16 internal constant ebytes128_size_t = 128;
    uint16 internal constant ebytes256_size_t = 256;

    string public constant ZAMA_DEV_MNEMONIC = "adapt mosquito move limb mobile illegal tree voyage juice mosquito burger raise father hope layer";

    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    TFHEExecutor private constant executor = TFHEExecutor(fhevmCoprocessorAdd);
    ACL private constant acl = ACL(aclAdd);

    function deployCodeTo(string memory what, bytes memory args, uint256 value, address where) internal {
        bytes memory creationCode = vm.getCode(what);
        vm.etch(where, abi.encodePacked(creationCode, args));
        (bool success, bytes memory runtimeBytecode) = where.call{value: value}("");
        require(success, "StdCheats deployCodeTo(string,bytes,uint256,address): Failed to create runtime bytecode.");
        vm.etch(where, runtimeBytecode);
    }

    function computeInput(uint64 value) public returns (einput handle, bytes memory proof) {
      bytes32 random = keccak256(abi.encode(vm.unixTime()));
      bytes memory p = computeProofU64(value, random);
      bytes32 h = computeHandleAt(Common.euint64_t, 0, keccak256(p));
      return (einput.wrap(h), p);
    }

    function computeProofBool(bool value, bytes32 random) public pure returns (bytes memory result) {
      return _computeProof(value ? 1 : 0, ebool_size_t, Common.ebool_t, random);
    }

    function computeProofU4(uint8 value, bytes32 random) public pure returns (bytes memory result) {
      return _computeProof(uint64(value), euint4_size_t, Common.euint4_t, random);
    }

    function computeProofU8(uint8 value, bytes32 random) public pure returns (bytes memory result) {
      return _computeProof(uint64(value), euint8_size_t, Common.euint8_t, random);
    }

    function computeProofU16(uint16 value, bytes32 random) public pure returns (bytes memory result) {
      return _computeProof(uint64(value), euint16_size_t, Common.euint16_t, random);
    }

    function computeProofU32(uint32 value, bytes32 random) public pure returns (bytes memory result) {
      return _computeProof(uint64(value), euint32_size_t, Common.euint32_t, random);
    }

    function computeProofU64(uint64 value, bytes32 random) public pure returns (bytes memory result) {
      return _computeProof(value, euint64_size_t, Common.euint64_t, random);
    }

    function _computeProof(uint64 value, uint16 sizeT, uint8 typeT, bytes32 random) private pure returns (bytes memory result) {
      bytes memory pad = new bytes(53 - 1 - sizeT - 32);
      result = bytes.concat(bytes1(typeT), bytes8(value), random, pad);
    }

    function computeHandleAt(uint8 hType, uint8 index, bytes32 proofHash) public pure returns (bytes32 result) {
      bytes32 handleNoIndex = keccak256(abi.encodePacked(proofHash, uint8(index)));
      result = (handleNoIndex & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffff000000) | (bytes32(uint256(index)) << 16) | (bytes32(uint256(hType)) << 8);
    }

    function decryptHandle256Unchecked(uint256 handle) public view returns (TFHEExecutorDB.Entry256 memory){
      return executor.db().get256(handle); 
    }

    function decryptHandle2048Unchecked(uint256 handle) public view returns (TFHEExecutorDB.Entry2048 memory){
      return executor.db().get2048(handle); 
    }

    function decrypt64(euint64 value, address contractAddress, address user) public view returns (uint64 result){
      uint256 handle = euint64.unwrap(value);
      if (handle == 0) {
        return 0;
      }
      assertValid(handle);
      require(acl.isAllowed(handle, contractAddress), "contract does not have permission to decrypt handle");
      require(acl.isAllowed(handle, user), "user does not have permission to decrypt handle");

      TFHEExecutorDB.Entry256 memory entry = executor.db().get256(handle); 
      return uint64(entry.value);
    }

    function decrypt64Unchecked(euint64 value) public view returns (uint64 result){
      uint256 handle = euint64.unwrap(value);
      if (handle == 0) {
        return 0;
      }

      TFHEExecutorDB.Entry256 memory entry = executor.db().get256(handle); 
      return uint64(entry.value);
    }

    function decrypt8Unchecked(euint8 value) public view returns (uint8 result){
      uint256 handle = euint8.unwrap(value);
      if (handle == 0) {
        return 0;
      }

      TFHEExecutorDB.Entry256 memory entry = executor.db().get256(handle); 
      return uint8(entry.value);
    }

    function decryptBoolUnchecked(ebool value) public view returns (bool result){
      uint256 handle = ebool.unwrap(value);
      if (handle == 0) {
        return false;
      }
      TFHEExecutorDB.Entry256 memory entry = executor.db().get256(handle); 
      return entry.value != 0;
    }

    function logHandle(uint256 handle, string memory label) public view {
      TFHEExecutorDB.Entry256 memory entry = executor.db().get256(handle); 
      console.log("name : %s", label);
      console.log(" - handle         : %s", handle);
      console.log(" - value          : %s", entry.value);
      console.log(" - type           : %s", entry.valueType);
      console.log(" - overflow       : %s", entry.overflow);
      console.log(" - underflow      : %s", entry.underflow);
      console.log(" - divisionByZero : %s", entry.divisionByZero);
      console.log(" - trivial        : %s", entry.trivial);
    }

    function logEuint64(euint64 handle, string memory label) public view {
      logHandle(euint64.unwrap(handle), label);
    }
    function logEbool(ebool handle, string memory label) public view {
      logHandle(ebool.unwrap(handle), label);
    }

    function assertValid(uint256 handle) public view {
      TFHEExecutorDB.Entry256 memory entry = executor.db().get256(handle); 
      require(entry.valueType != 0, "Handle does not exist");
      require(!entry.divisionByZero, "Handle inherits from a division by zero");
      require(!entry.overflow, "Handle inherits from an arithmetic overflow");
      require(!entry.underflow, "Handle inherits from an arithmetic underflow");
    }

    function assertValidEuint64(euint64 value) public view {
      assertValid(euint64.unwrap(value));
    }
    
    function assertValidEbool(ebool value) public view {
      assertValid(ebool.unwrap(value));
    }

    function startCheckArithmetic() public {
      executor.db().startCheckArithmetic();
    }
    
    function startCheckArithmetic(ArithmeticCheckingMode mode) public {
      executor.db().startCheckArithmetic(uint8(mode));
    }
    
    function stopCheckArithmetic() public {
      executor.db().stopCheckArithmetic();
    }

    function checkArithmetic() public {
      executor.db().checkArithmetic();
    }

    function checkArithmetic(ArithmeticCheckingMode mode) public {
      executor.db().checkArithmetic(uint8(mode));
    }
}
