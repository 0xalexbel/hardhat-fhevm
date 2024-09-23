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
      bytes memory p = computeProof(value, random);
      bytes32 h = computeHandleAt(0, keccak256(p));
      return (einput.wrap(h), p);
    }

    function computeProof(uint64 value, bytes32 random) public pure returns (bytes memory result) {
      uint8 sizeT = 8; // 8*8 = 64
      bytes memory pad = new bytes(53 - 1 - sizeT - 32);
      result = bytes.concat(bytes1(Common.euint64_t), bytes8(value), random, pad);
    }

    function computeHandleAt(uint8 index, bytes32 proofHash) public pure returns (bytes32 result) {
      bytes32 handleNoIndex = keccak256(abi.encodePacked(proofHash, uint8(index)));
      result = (handleNoIndex & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffff000000) | (bytes32(uint256(index)) << 16) | (bytes32(uint256(Common.euint64_t)) << 8);
    }

}