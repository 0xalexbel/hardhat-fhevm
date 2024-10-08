// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {ACL} from "fhevm/lib/ACL.sol";
import {TFHEExecutor, EXT_TFHE_LIBRARY} from "fhevm/lib/TFHEExecutor.sol";
import {KMSVerifier} from "fhevm/lib/KMSVerifier.sol";
import {GatewayContract} from "fhevm/gateway/GatewayContract.sol";
import {MockedPrecompile} from "fhevm/lib/MockedPrecompile.sol";

import {fhevmCoprocessorAdd} from "fhevm/lib/FHEVMCoprocessorAddress.sol";
import {aclAdd} from "fhevm/lib/ACLAddress.sol";
import {KMS_VERIFIER_CONTRACT_ADDRESS} from "fhevm/lib/KMSVerifierAddress.sol";
import {GATEWAY_CONTRACT_PREDEPLOY_ADDRESS} from "fhevm/gateway/lib/PredeployAddress.sol";

import {fhevm} from "./fhevm.sol";

contract FhevmScript is Script {
    ACL public acl;
    TFHEExecutor public executor;
    KMSVerifier public kmsVerifier;
    GatewayContract public gateway;
    MockedPrecompile public mockedPrecompile;

    function deployFhevm(string memory mnemonic) internal {
        uint256 privateKey = vm.deriveKey(mnemonic, 9);
        address deployer = vm.rememberKey(privateKey);

        address expectedACLAddr = vm.computeCreateAddress(deployer, 0);
        address expectedTFHEExecutorAddr = vm.computeCreateAddress(deployer, 1);
        address expectedKMSVerifierAddr = vm.computeCreateAddress(deployer, 2);

        //0xcCAe95fF1d11656358E782570dF0418F59fA40e1
        address expectedMockedPrecompileAddr = vm.computeCreateAddress(deployer, 3);

        // already deployed:
        // 1/ start anvil or 'npx hardhat node'
        // 2/ run 'npx hardhat --network localhost fhevm setup'
        if (expectedACLAddr.code.length != 0) {
            return;
        }

        vm.startBroadcast(deployer);
        
        acl = new ACL(fhevmCoprocessorAdd);
        executor = new TFHEExecutor();
        kmsVerifier = new KMSVerifier();

        vm.assertEq(expectedACLAddr, aclAdd);
        vm.assertEq(expectedTFHEExecutorAddr, fhevmCoprocessorAdd);
        vm.assertEq(expectedKMSVerifierAddr, KMS_VERIFIER_CONTRACT_ADDRESS);

        vm.assertEq(address(acl), aclAdd);
        vm.assertEq(address(executor), fhevmCoprocessorAdd);
        vm.assertEq(address(kmsVerifier), KMS_VERIFIER_CONTRACT_ADDRESS);

        if (EXT_TFHE_LIBRARY == 0x000000000000000000000000000000000000005d) {
            fhevm.deployCodeTo("fhevm/lib/MockedPrecompile.sol", "", 0, EXT_TFHE_LIBRARY);
            mockedPrecompile = MockedPrecompile(EXT_TFHE_LIBRARY);
            vm.assertEq(address(mockedPrecompile), EXT_TFHE_LIBRARY);
        } else {
            mockedPrecompile = new MockedPrecompile();
            vm.assertEq(address(mockedPrecompile), expectedMockedPrecompileAddr);
            vm.assertEq(address(mockedPrecompile), EXT_TFHE_LIBRARY);
        }

        vm.stopBroadcast();
    }

    function deployGateway(string memory mnemonic) internal {
        uint256 privateKey = vm.deriveKey(mnemonic, 4);
        address deployer = vm.rememberKey(privateKey);

        address expectedGatewayAddr = vm.computeCreateAddress(deployer, 0);

        // already deployed:
        // 1/ start anvil or 'npx hardhat node'
        // 2/ run 'npx hardhat --network localhost fhevm setup'
        if (expectedGatewayAddr.code.length != 0) {
            return;
        }

        vm.assertEq(expectedGatewayAddr, GATEWAY_CONTRACT_PREDEPLOY_ADDRESS);

        vm.startBroadcast(deployer);

        gateway = new GatewayContract(deployer, KMS_VERIFIER_CONTRACT_ADDRESS);

        vm.assertEq(address(gateway), GATEWAY_CONTRACT_PREDEPLOY_ADDRESS);

        vm.stopBroadcast();
    }

    function setUp() public virtual {
        //string memory mnemonic = "adapt mosquito move limb mobile illegal tree voyage juice mosquito burger raise father hope layer";

        deployFhevm(fhevm.ZAMA_DEV_MNEMONIC);
        deployGateway(fhevm.ZAMA_DEV_MNEMONIC);
    }
}