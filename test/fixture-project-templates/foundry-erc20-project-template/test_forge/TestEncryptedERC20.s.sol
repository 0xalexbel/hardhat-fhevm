// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {console} from "forge-std/console.sol";
import {fhevm} from "forge-fhevm/fhevm.sol";
import {FhevmScript} from "forge-fhevm/FhevmScript.sol";

import {TFHE, euint64, einput, Common} from "fhevm/lib/TFHE.sol";
import {TFHEExecutorDB} from "fhevm/lib/TFHEExecutorDB.sol";

import {Signers} from "./Signers.sol";

import {EncryptedERC20} from "contracts/EncryptedERC20.sol";

contract TestEncryptedERC20 is FhevmScript {
    EncryptedERC20 erc20;
    Signers signers;
    uint256 beforeEachSnapshot;

    function setUp() public override(FhevmScript) {
        signers = new Signers();
        signers.setUpWallets();

        super.setUp();

        vm.broadcast(signers.alice());
        erc20 = new EncryptedERC20("Naraggara", "NARA");
        beforeEachSnapshot = vm.snapshot();
    }

    function should_mint_contract() public {
        vm.assertEq(erc20.owner(), signers.aliceAddr());

        vm.broadcast(signers.alice());
        erc20.mint(1000);

        euint64 balanceHandle = erc20.balanceOf(signers.aliceAddr());
        uint64 balance = fhevm.decrypt64(balanceHandle, address(erc20), signers.aliceAddr());
        vm.assertEq(balance, 1000);

        uint64 totalSupply = erc20.totalSupply();
        vm.assertEq(totalSupply, 1000);
    }

    function should_transfer_tokens_between_two_users() public {
        vm.assertEq(erc20.owner(), signers.aliceAddr());

        vm.broadcast(signers.alice());
        erc20.mint(10000);

        euint64 balanceHandleAlice = erc20.balanceOf(signers.aliceAddr());
        fhevm.assertValidEuint64(balanceHandleAlice);

        bytes memory proof;
        einput handle;

        (handle, proof) = fhevm.computeInput(1337);

        address bobAddr = signers.bobAddr();

        vm.broadcast(signers.alice());
        erc20.transfer(bobAddr, handle, proof);

        // Decrypt Alice's balance
        balanceHandleAlice = erc20.balanceOf(signers.aliceAddr());
        fhevm.assertValidEuint64(balanceHandleAlice);

        uint64 balanceAlice = fhevm.decrypt64(balanceHandleAlice, address(erc20), signers.aliceAddr());
        vm.assertEq(balanceAlice, 10000 - 1337);

        // Decrypt Bob's balance
        euint64 balanceHandleBob = erc20.balanceOf(bobAddr);
        uint64 balanceBob = fhevm.decrypt64(balanceHandleBob, address(erc20), bobAddr);
        vm.assertEq(balanceBob, 1337);
    }

    function should_not_transfer_tokens_between_two_users() public {
        vm.assertEq(erc20.owner(), signers.aliceAddr());

        vm.broadcast(signers.alice());
        erc20.mint(1000);

        bytes memory proof;
        einput handle;
        (handle, proof) = fhevm.computeInput(1337);

        address bobAddr = signers.bobAddr();

        vm.broadcast(signers.alice());
        erc20.transfer(bobAddr, handle, proof);

        // Decrypt Alice's balance
        euint64 balanceHandleAlice = erc20.balanceOf(signers.aliceAddr());
        uint64 balanceAlice = fhevm.decrypt64(balanceHandleAlice, address(erc20), signers.aliceAddr());
        vm.assertEq(balanceAlice, 1000);

        // Decrypt Bob's balance
        euint64 balanceHandleBob = erc20.balanceOf(bobAddr);
        uint64 balanceBob = fhevm.decrypt64(balanceHandleBob, address(erc20), bobAddr);
        vm.assertEq(balanceBob, 0);
    }

    function should_be_able_to_transferFrom_only_if_allowance_is_sufficient() public {
        address aliceAddr = signers.aliceAddr();
        address bobAddr = signers.bobAddr();

        vm.assertEq(erc20.owner(), aliceAddr);

        vm.broadcast(signers.alice());
        erc20.mint(10000);

        bytes memory proof;
        einput encAmount;

        // Alice approves Bob, amount: 1337
        (encAmount, proof) = fhevm.computeInput(1337);

        vm.broadcast(signers.alice());
        erc20.approve(bobAddr, encAmount, proof);

        // Bob transfers from Alice, amount: 1338
        (encAmount, proof) = fhevm.computeInput(1338);

        vm.broadcast(signers.bob());
        erc20.transferFrom(aliceAddr, bobAddr, encAmount, proof);

        // Decrypt Alice's balance
        euint64 balanceHandleAlice = erc20.balanceOf(signers.aliceAddr());
        uint64 balanceAlice = fhevm.decrypt64(balanceHandleAlice, address(erc20), signers.aliceAddr());
        // check that transfer did not happen, as expected
        vm.assertEq(balanceAlice, 10000);

        // Decrypt Bob's balance
        euint64 balanceHandleBob = erc20.balanceOf(bobAddr);
        uint64 balanceBob = fhevm.decrypt64(balanceHandleBob, address(erc20), bobAddr);
        // check that transfer did not happen, as expected
        vm.assertEq(balanceBob, 0);

        // Bob transfers from Alice, amount: 1337
        (encAmount, proof) = fhevm.computeInput(1337);

        vm.broadcast(signers.bob());
        erc20.transferFrom(aliceAddr, bobAddr, encAmount, proof);

        // Decrypt Alice's balance
        balanceHandleAlice = erc20.balanceOf(signers.aliceAddr());
        balanceAlice = fhevm.decrypt64(balanceHandleAlice, address(erc20), signers.aliceAddr());
        // check that transfer did actually happen, as expected
        vm.assertEq(balanceAlice, 10000 - 1337);

        // Decrypt Bob's balance
        balanceHandleBob = erc20.balanceOf(bobAddr);
        balanceBob = fhevm.decrypt64(balanceHandleBob, address(erc20), bobAddr);
        // check that transfer did actually happen, as expected
        vm.assertEq(balanceBob, 1337);
    }

    function run() public {
        vm.revertTo(beforeEachSnapshot);
        should_mint_contract();

        vm.revertTo(beforeEachSnapshot);
        should_transfer_tokens_between_two_users();

        vm.revertTo(beforeEachSnapshot);
        should_not_transfer_tokens_between_two_users();

        vm.revertTo(beforeEachSnapshot);
        should_be_able_to_transferFrom_only_if_allowance_is_sufficient();
    }
}
