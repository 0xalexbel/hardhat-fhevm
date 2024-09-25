// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";
import {console} from "forge-std/console.sol";

import {ACL} from "fhevm/lib/ACL.sol";
import {TFHEExecutor, EXT_TFHE_LIBRARY} from "fhevm/lib/TFHEExecutor.sol";
import {KMSVerifier} from "fhevm/lib/KMSVerifier.sol";
import {GatewayContract} from "fhevm/gateway/GatewayContract.sol";
import {MockedPrecompile} from "fhevm/lib/MockedPrecompile.sol";
import {TFHE, euint64, einput, Common} from "fhevm/lib/TFHE.sol";

import {fhevmCoprocessorAdd} from "fhevm/lib/FHEVMCoprocessorAddress.sol";
import {aclAdd} from "fhevm/lib/ACLAddress.sol";
import {KMS_VERIFIER_CONTRACT_ADDRESS} from "fhevm/lib/KMSVerifierAddress.sol";
import {GATEWAY_CONTRACT_PREDEPLOY_ADDRESS} from "fhevm/gateway/lib/PredeployAddress.sol";

library fhevm {
    uint8 internal constant ebool_size_t = 1;
    uint8 internal constant euint4_size_t = 1;
    uint8 internal constant euint8_size_t = 1;
    uint8 internal constant euint16_size_t = 2;
    uint8 internal constant euint32_size_t = 4;
    uint8 internal constant euint64_size_t = 8;
    uint8 internal constant euint128_size_t = 16;
    uint8 internal constant eaddress_size_t = 20;
    uint8 internal constant euint256_size_t = 32;
    uint8 internal constant ebytes64_size_t = 64;
    uint8 internal constant ebytes128_size_t = 128;
    uint8 internal constant ebytes256_size_t = 256;

    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

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
      return _computeProof(value, ebool_size_t, Common.ebool_t, random);
    }

    function computeProofU4(uint4 value, bytes32 random) public pure returns (bytes memory result) {
      return _computeProof(value, euint4_size_t, Common.euint4_t, random);
    }

    function computeProofU8(uint8 value, bytes32 random) public pure returns (bytes memory result) {
      return _computeProof(value, euint8_size_t, Common.euint8_t, random);
    }

    function computeProofU16(uint16 value, bytes32 random) public pure returns (bytes memory result) {
      return _computeProof(value, euint16_size_t, Common.euint16_t, random);
    }

    function computeProofU32(uint32 value, bytes32 random) public pure returns (bytes memory result) {
      return _computeProof(value, euint32_size_t, Common.euint32_t, random);
    }

    function computeProofU64(uint64 value, bytes32 random) public pure returns (bytes memory result) {
      return _computeProof(value, euint64_size_t, Common.euint64_t, random);
    }

    function computeProofAddress(address value, bytes32 random) public pure returns (bytes memory result) {
      return _computeProof(value, eaddress_size_t, Common.euint160_t, random);
    }

    function _computeProof(uint32 value, uint8 sizeT, uint8 typeT, bytes32 random) private pure returns (bytes memory result) {
      bytes memory pad = new bytes(53 - 1 - sizeT - 32);
      result = bytes.concat(bytes1(typeT), bytes8(value), random, pad);
    }

    function computeHandleAt(uint8 hType, uint8 index, bytes32 proofHash) public pure returns (bytes32 result) {
      bytes32 handleNoIndex = keccak256(abi.encodePacked(proofHash, uint8(index)));
      result = (handleNoIndex & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffff000000) | (bytes32(uint256(index)) << 16) | (bytes32(uint256(hType)) << 8);
    }
}