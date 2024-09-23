// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import {ACL} from "fhevm/lib/ACL.sol";
import {aclAdd} from "fhevm/lib/ACLAddress.sol";
import {FhevmLib} from "fhevm/lib/FhevmLib.sol";

address constant EXT_TFHE_LIBRARY = address(0x000000000000000000000000000000000000005d);

contract TFHEExecutor {
    uint256[8] private MAX_UINT = [
        1, // 2**1 - 1 (0, ebool_t)
        0xF, // 2**4 - 1 (1, euint4_t)
        0xFF, // 2**8 - 1 (2, euint8_t)
        0xFFFF, // 2**16 - 1 (3, euint16_t)
        0xFFFFFFFF, // 2**32 - 1 (4, euint32_t)
        0xFFFFFFFFFFFFFFFF, // 2**64 - 1 (5, euint64_t)
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF, // 2**128 - 1 (6, euint128_t))
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF // 2**256 - 1 (7, euint256_t))
    ];

    mapping (uint256 => uint256) public db;
    uint256 public dbSaveCount;

    ACL private constant acl = ACL(address(aclAdd));

    function typeOf(uint256 handle) internal pure returns (uint8) {
        uint8 typeCt = uint8(handle >> 8);
        return typeCt;
    }

    function fheAdd(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheAdd(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        // Compute Add
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);

        dbSaveCount++;

        db[result] = (clearLhs + clearRhs) % (MAX_UINT[lhsType] + 1);
    }
    function fheSub(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheSub(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        // Compute Sub
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);

        dbSaveCount++;

        unchecked { db[result] = (clearLhs - clearRhs) % (MAX_UINT[lhsType] + 1); }
    }
    function fheMul(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheMul(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        // Compute Mul
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);

        dbSaveCount++;

        db[result] = (clearLhs * clearRhs) % (MAX_UINT[lhsType] + 1);
    }
    function fheDiv(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheDiv(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        // Compute Div
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);
        
        dbSaveCount++;

        if (clearRhs == 0) {
            db[result] = MAX_UINT[lhsType];
        } else {
            db[result] = (clearLhs / clearRhs) % (MAX_UINT[lhsType] + 1);
        }
    }
    function fheRem(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheRem(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        // Compute Rem
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);

        dbSaveCount++;

        if (clearRhs == 0) {
            db[result] = 0;
        } else {
            db[result] = (clearLhs % clearRhs) % (MAX_UINT[lhsType] + 1);
        }
    }
    function fheBitAnd(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheBitAnd(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        // Compute BitAnd
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);

        dbSaveCount++;

        db[result] = clearLhs & clearRhs;
    }
    function fheBitOr(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheBitOr(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        // Compute BitOr
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);

        dbSaveCount++;

        db[result] = clearLhs | clearRhs;
    }
    function fheBitXor(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheBitXor(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        // Compute BitXor
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);

        dbSaveCount++;

        db[result] = clearLhs ^ clearRhs;
    }
    function fheShl(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheShl(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        revert("Operator Shl not implemented");
    }
    function fheShr(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheShr(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        revert("Operator Shr not implemented");
    }
    function fheRotl(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheRotl(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        revert("Operator Rotl not implemented");
    }
    function fheRotr(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheRotr(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        revert("Operator Rotr not implemented");
    }
    function fheEq(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheEq(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        // Compute Eq
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);

        dbSaveCount++;

        db[result] = (clearLhs == clearRhs) ? 1 : 0;
    }
    function fheNe(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheNe(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        // Compute Ne
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);

        dbSaveCount++;

        db[result] = (clearLhs != clearRhs) ? 1 : 0;
    }
    function fheGe(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheGe(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        // Compute Ge
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);

        dbSaveCount++;

        db[result] = (clearLhs >= clearRhs) ? 1 : 0;
    }
    function fheGt(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheGt(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        // Compute Gt
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);

        dbSaveCount++;

        db[result] = (clearLhs > clearRhs) ? 1 : 0;
    }
    function fheLe(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheLe(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        // Compute Le
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);

        dbSaveCount++;

        db[result] = (clearLhs <= clearRhs) ? 1 : 0;
    }
    function fheLt(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheLt(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        // Compute Lt
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);

        dbSaveCount++;

        db[result] = (clearLhs < clearRhs) ? 1 : 0;
    }
    function fheMin(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheMin(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        // Compute Min
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);

        dbSaveCount++;

        db[result] = (clearLhs < clearRhs) ? clearLhs : clearRhs;
    }
    function fheMax(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        uint256 clearRhs;
        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
            clearRhs = db[rhs];
        } else {
            clearRhs = rhs;
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheMax(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        // Compute Max
        uint8 lhsType = typeOf(lhs);
        uint256 clearLhs = db[lhs];

        require(lhsType <= 5);
        
        dbSaveCount++;

        db[result] = (clearLhs > clearRhs) ? clearLhs : clearRhs;
    }
    function fheNeg(uint256 ct) external returns (uint256 result) {
        require(acl.isAllowed(ct, msg.sender));
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheNeg(ct);
        acl.allowTransient(result, msg.sender);

        revert("Operator Neg not implemented");
    }
    function fheNot(uint256 ct) external returns (uint256 result) {
        require(acl.isAllowed(ct, msg.sender));
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheNot(ct);
        acl.allowTransient(result, msg.sender);

        uint8 ctType = typeOf(ct);
        uint256 clearCt = db[ct];

        require(ctType <= 5);

        dbSaveCount++;

        db[result] = (clearCt ^ type(uint256).max) & MAX_UINT[ctType];
    }

    function bytesToBytes8(bytes memory b, uint offset) private pure returns (bytes8) {
        bytes8 out;

        for (uint i = 0; i < 8; i++) {
            out |= bytes8(b[offset + i] & 0xFF) >> (i * 8);
        }
        return out;
    }

    function verifyCiphertext(
        bytes32 inputHandle,
        address callerAddress,
        bytes memory inputProof,
        bytes1 inputType
    ) external returns (uint256 result) {
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).verifyCiphertext(
            inputHandle,
            callerAddress,
            msg.sender,
            inputProof,
            inputType
        );

        // extract index in proof
        uint256 indexHandle = uint256((inputHandle & 0x0000000000000000000000000000000000000000000000000000000000ff0000) >> 16);
        require(indexHandle == 0, "indexHandle greater than zero are not yet supported");

        // extract handle type
        uint8 typeCt = uint8(inputProof[0]);
        require(typeCt == 5, "Only uint64 are supported");

        if (typeCt == 5) {
            uint64 clearUint64 = uint64(bytesToBytes8(inputProof, 1));
            dbSaveCount++;
            db[result] = clearUint64;
        }
        acl.allowTransient(result, msg.sender);
    }
    function cast(uint256 ct, bytes1 toType) external returns (uint256 result) {
        require(acl.isAllowed(ct, msg.sender));
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).cast(ct, toType);
        acl.allowTransient(result, msg.sender);

        revert("Operator cast not implemented");
    }
    function trivialEncrypt(uint256 plaintext, bytes1 toType) external returns (uint256 result) {
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).trivialEncrypt(plaintext, toType);
        
        uint8 toT = uint8(toType);
        
        require(toT <= 7, "Unsupported type");
        require(plaintext <= MAX_UINT[toT], "Value overflow");

        dbSaveCount++;
        
        // Save in db
        db[result] = plaintext;

        acl.allowTransient(result, msg.sender);
    }
    function fheIfThenElse(uint256 control, uint256 ifTrue, uint256 ifFalse) external returns (uint256 result) {
        require(acl.isAllowed(control, msg.sender));
        require(acl.isAllowed(ifTrue, msg.sender));
        require(acl.isAllowed(ifFalse, msg.sender));
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheIfThenElse(control, ifTrue, ifFalse);

        uint256 clearControl = db[control];
        uint256 clearTrue = db[ifTrue];
        uint256 clearFalse = db[ifFalse];

        dbSaveCount++;

        if (clearControl == 0) {
            db[result] = clearFalse;
        } else {
            db[result] = clearTrue;
        }

        acl.allowTransient(result, msg.sender);
    }
    function fheRand(bytes1 randType) external returns (uint256 result) {
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheRand(randType, 0);
        acl.allowTransient(result, msg.sender);

        revert("Operator Rand not implemented");
    }
    function fheRandBounded(uint256 upperBound, bytes1 randType) external returns (uint256 result) {
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheRandBounded(upperBound, randType, 0);
        acl.allowTransient(result, msg.sender);

        revert("Operator RandBounded not implemented");
    }
    function cleanTransientStorage() external {}
}
