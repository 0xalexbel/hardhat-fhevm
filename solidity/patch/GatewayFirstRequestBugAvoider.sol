// SPDX-License-Identifier: BSD-3-Clause-Clear 
pragma solidity ^0.8.24;
  
import {TFHE, euint8} from "fhevm/lib/TFHE.sol";
import {GatewayCaller} from "fhevm/gateway/GatewayCaller.sol";
import {Gateway} from "fhevm/gateway/lib/Gateway.sol";
  
contract GatewayFirstRequestBugAvoider is GatewayCaller {
    euint8 xUint8;
  
    uint8 public yUint8;
  
    uint256 public latestRequestID;
  
    constructor() {
        xUint8 = TFHE.asEuint8(42);
        TFHE.allow(xUint8, address(this));
    }
  
    function requestUint8() public {
        uint256[] memory cts = new uint256[](1);
        cts[0] = Gateway.toUint256(xUint8);
        Gateway.requestDecryption(cts, this.callbackUint8.selector, 0, block.timestamp + 100, false);
    }
  
    function callbackUint8(uint256, uint8 decryptedInput) public onlyGateway returns (uint8) {
        yUint8 = decryptedInput;
        return decryptedInput;
    }
}