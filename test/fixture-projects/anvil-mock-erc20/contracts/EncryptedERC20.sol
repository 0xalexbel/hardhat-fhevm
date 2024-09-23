// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/lib/TFHE.sol";
import {fhevmCoprocessorAdd} from "fhevm/lib/FHEVMCoprocessorAddress.sol";
import {TFHEExecutor} from "fhevm/lib/TFHEExecutor.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "hardhat/console.sol";

contract EncryptedERC20 is Ownable2Step {
    event Transfer(address indexed from, address indexed to);
    event Approval(address indexed owner, address indexed spender);
    event Mint(address indexed to, uint64 amount);

    uint64 private _totalSupply;
    uint64 private _totalSupply2;
    string private _name;
    string private _symbol;
    uint8 public constant decimals = 6;

    // A mapping from address to an encrypted balance.
    mapping(address => euint64) internal balances;

    // A mapping of the form mapping(owner => mapping(spender => allowance)).
    mapping(address => mapping(address => euint64)) internal allowances;

    constructor(string memory name_, string memory symbol_) Ownable(msg.sender) {
        _name = name_;
        _symbol = symbol_;
    }

    // Returns the name of the token.
    function name() public view virtual returns (string memory) {
        return _name;
    }

    // Returns the symbol of the token, usually a shorter version of the name.
    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    // Returns the total supply of the token
    function totalSupply() public view virtual returns (uint64) {
        return _totalSupply;
    }

    // Sets the balance of the owner to the given encrypted balance.
    function mint2(uint64 mintedAmount) public virtual onlyOwner {
        balances[owner()] = TFHE.add(balances[owner()], mintedAmount); // overflow impossible because of next line
        _totalSupply2 = _totalSupply2 + mintedAmount;
        emit Mint(owner(), mintedAmount);
    }

    // Sets the balance of the owner to the given encrypted balance.
    function mint(uint64 mintedAmount) public virtual onlyOwner {
        euint64 emintedAmount = TFHE.asEuint64(mintedAmount);
        balances[owner()] = TFHE.add(balances[owner()], emintedAmount); // overflow impossible because of next line
        TFHE.allow(balances[owner()], address(this));
        TFHE.allow(balances[owner()], owner());
        _totalSupply = _totalSupply + mintedAmount;
        emit Mint(owner(), mintedAmount);
    }

    // // function typeOf(uint256 handle) internal pure returns (uint8) {
    // //     uint8 typeCt = uint8(handle >> 8);
    // //     return typeCt;
    // // }
    // function bytesToBytes8(bytes calldata b, uint offset) private pure returns (bytes8) {
    //     bytes8 out;

    //     for (uint i = 0; i < 8; i++) {
    //         out |= bytes8(b[offset + i] & 0xFF) >> (i * 8);
    //     }
    //     return out;
    // }

    // function bytesToBytes1(bytes calldata b, uint offset) private pure returns (bytes1) {
    //     return bytes1(b[0] & 0xFF) >> 0;
    // }

    // function decrypt64(euint64 value) private returns (uint256) {
    //     uint256 clear = TFHEExecutor(fhevmCoprocessorAdd).db(euint64.unwrap(value));
    //     return clear;
    // }
    // function decryptBool(ebool value) private returns (uint256) {
    //     uint256 clear = TFHEExecutor(fhevmCoprocessorAdd).db(ebool.unwrap(value));
    //     return clear;
    // }

    // Transfers an encrypted amount from the message sender address to the `to` address.
    function transfer(address to, einput encryptedAmount, bytes calldata inputProof) public virtual returns (bool) {
//         uint8 typeCt = uint8(inputProof[0]);
//         bytes8 ct = bytesToBytes8(inputProof, 1);
//         uint64 aa = uint64(ct);
// //0500000000000005390c1ee18584c5384d59533852dc9d69716185780bfe5a1f80d04b6151a2efb35f000000000000000000000000
//         console.log("TYPE =================");
//         console.log("%s", typeCt);
//         console.logBytes8(ct);
//         console.log("%s", aa);
//         console.log("BYTES32 =================");
//         console.logBytes32(einput.unwrap(encryptedAmount));
//         console.log("BYTES =================");
//         console.logBytes(inputProof);
//         console.log("=================");
//         console.logBytes1(inputProof[7]);
//         console.logBytes1(inputProof[8]);
//         console.logBytes1(inputProof[9]);
//         console.logBytes1(inputProof[10]);
//         //uint8 typeCt = uint8(handle >> 8);

//         //console.log("inputProof= %s", inputProof);
        transfer(to, TFHE.asEuint64(encryptedAmount, inputProof));
        return true;
    }

    // Transfers an amount from the message sender address to the `to` address.
    function transfer(address to, euint64 amount) public virtual returns (bool) {
        require(TFHE.isSenderAllowed(amount));
        // makes sure the owner has enough tokens
        ebool canTransfer = TFHE.le(amount, balances[msg.sender]);
        _transfer(msg.sender, to, amount, canTransfer);
        return true;
    }

    // Returns the balance handle of the caller.
    function balanceOf(address wallet) public view virtual returns (euint64) {
        return balances[wallet];
    }

    // Sets the `encryptedAmount` as the allowance of `spender` over the caller's tokens.
    function approve(address spender, einput encryptedAmount, bytes calldata inputProof) public virtual returns (bool) {
        approve(spender, TFHE.asEuint64(encryptedAmount, inputProof));
        return true;
    }

    // Sets the `amount` as the allowance of `spender` over the caller's tokens.
    function approve(address spender, euint64 amount) public virtual returns (bool) {
        require(TFHE.isSenderAllowed(amount));
        address owner = msg.sender;
        _approve(owner, spender, amount);
        emit Approval(owner, spender);
        return true;
    }

    // Returns the remaining number of tokens that `spender` is allowed to spend
    // on behalf of the caller.
    function allowance(address owner, address spender) public view virtual returns (euint64) {
        return _allowance(owner, spender);
    }

    // Transfers `encryptedAmount` tokens using the caller's allowance.
    function transferFrom(
        address from,
        address to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) public virtual returns (bool) {
        transferFrom(from, to, TFHE.asEuint64(encryptedAmount, inputProof));
        return true;
    }

    // Transfers `amount` tokens using the caller's allowance.
    function transferFrom(address from, address to, euint64 amount) public virtual returns (bool) {
        require(TFHE.isSenderAllowed(amount));

        address spender = msg.sender;
        ebool isTransferable = _updateAllowance(from, spender, amount);
        _transfer(from, to, amount, isTransferable);
        return true;
    }

    function _approve(address owner, address spender, euint64 amount) internal virtual {
        allowances[owner][spender] = amount;
        TFHE.allow(amount, address(this));
        TFHE.allow(amount, owner);
        TFHE.allow(amount, spender);
    }

    function _allowance(address owner, address spender) internal view virtual returns (euint64) {
        return allowances[owner][spender];
    }

    function _updateAllowance(address owner, address spender, euint64 amount) internal virtual returns (ebool) {
        euint64 currentAllowance = _allowance(owner, spender);
        // makes sure the allowance suffices
        ebool allowedTransfer = TFHE.le(amount, currentAllowance); //true
        // makes sure the owner has enough tokens
        ebool canTransfer = TFHE.le(amount, balances[owner]); //true
        ebool isTransferable = TFHE.and(canTransfer, allowedTransfer); //true
        _approve(owner, spender, TFHE.select(isTransferable, TFHE.sub(currentAllowance, amount), currentAllowance));
        return isTransferable;
    }

    // Transfers an encrypted amount.
    function _transfer(address from, address to, euint64 amount, ebool isTransferable) internal virtual {
        // Add to the balance of `to` and subract from the balance of `from`.
        euint64 transferValue = TFHE.select(isTransferable, amount, TFHE.asEuint64(0));
        euint64 newBalanceTo = TFHE.add(balances[to], transferValue);
        balances[to] = newBalanceTo;
        TFHE.allow(newBalanceTo, address(this));
        TFHE.allow(newBalanceTo, to);
        euint64 newBalanceFrom = TFHE.sub(balances[from], transferValue);
        balances[from] = newBalanceFrom;
        TFHE.allow(newBalanceFrom, address(this));
        TFHE.allow(newBalanceFrom, from);
        emit Transfer(from, to);
    }
}
