// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import {ACL} from "fhevm/lib/ACL.sol";
import {aclAdd} from "fhevm/lib/ACLAddress.sol";
import {FhevmLib} from "fhevm/lib/FhevmLib.sol";
import {TFHEExecutorDB} from "./TFHEExecutorDB.sol";

address constant EXT_TFHE_LIBRARY = address(0x000000000000000000000000000000000000005d);

contract TFHEExecutor {
    ACL private constant acl = ACL(address(aclAdd));
    TFHEExecutorDB public db;

    constructor() {
        db = new TFHEExecutorDB();
    }

    function fheAdd(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheAdd(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheAdd(result, lhs, rhs, scalarByte);
    }
    function fheSub(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheSub(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheSub(result, lhs, rhs, scalarByte);
    }
    function fheMul(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheMul(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheMul(result, lhs, rhs, scalarByte);
    }
    function fheDiv(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheDiv(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheDiv(result, lhs, rhs, scalarByte);
    }
    function fheRem(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheRem(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheRem(result, lhs, rhs, scalarByte);
    }
    function fheBitAnd(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));
        require(acl.isAllowed(rhs, msg.sender));
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheBitAnd(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheBitAnd(result, lhs, rhs, scalarByte);
    }
    function fheBitOr(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));
        require(acl.isAllowed(rhs, msg.sender));
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheBitOr(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheBitOr(result, lhs, rhs, scalarByte);
    }
    function fheBitXor(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));
        require(acl.isAllowed(rhs, msg.sender));
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheBitXor(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheBitXor(result, lhs, rhs, scalarByte);
    }
    function fheShl(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheShl(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheShl(result, lhs, rhs, scalarByte);
    }
    function fheShr(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheShr(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheShr(result, lhs, rhs, scalarByte);
    }
    function fheRotl(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheRotl(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheRotl(result, lhs, rhs, scalarByte);
    }
    function fheRotr(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheRotr(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheRotr(result, lhs, rhs, scalarByte);
    }
    function fheEq(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheEq(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheEq(result, lhs, rhs, scalarByte);
    }
    function fheNe(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheNe(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheNe(result, lhs, rhs, scalarByte);
    }
    function fheGe(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheGe(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheGe(result, lhs, rhs, scalarByte);
    }
    function fheGt(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheGt(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheGt(result, lhs, rhs, scalarByte);
    }
    function fheLe(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheLe(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheLe(result, lhs, rhs, scalarByte);
    }
    function fheLt(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheLt(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheLt(result, lhs, rhs, scalarByte);
    }
    function fheMin(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheMin(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheMin(result, lhs, rhs, scalarByte);
    }
    function fheMax(uint256 lhs, uint256 rhs, bytes1 scalarByte) external returns (uint256 result) {
        require(acl.isAllowed(lhs, msg.sender));

        if (scalarByte == 0x00) {
            require(acl.isAllowed(rhs, msg.sender));
        }

        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheMax(lhs, rhs, scalarByte);
        acl.allowTransient(result, msg.sender);

        db.fheMax(result, lhs, rhs, scalarByte);
    }
    function fheNeg(uint256 ct) external returns (uint256 result) {
        require(acl.isAllowed(ct, msg.sender));
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheNeg(ct);
        acl.allowTransient(result, msg.sender);
        db.fheNeg(result, ct);
    }
    function fheNot(uint256 ct) external returns (uint256 result) {
        require(acl.isAllowed(ct, msg.sender));
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheNot(ct);
        acl.allowTransient(result, msg.sender);
        db.fheNot(result, ct);
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
        acl.allowTransient(result, msg.sender);
        db.verifyCiphertext(result, inputHandle, callerAddress, inputProof, inputType);
    }
    function cast(uint256 ct, bytes1 toType) external returns (uint256 result) {
        require(acl.isAllowed(ct, msg.sender));
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).cast(ct, toType);
        acl.allowTransient(result, msg.sender);
        db.cast(result, ct, toType);
    }
    function trivialEncrypt(uint256 plaintext, bytes1 toType) external returns (uint256 result) {
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).trivialEncrypt(plaintext, toType);
        acl.allowTransient(result, msg.sender);
        db.trivialEncrypt(result, plaintext, toType);
    }
    function fheIfThenElse(uint256 control, uint256 ifTrue, uint256 ifFalse) external returns (uint256 result) {
        require(acl.isAllowed(control, msg.sender));
        require(acl.isAllowed(ifTrue, msg.sender));
        require(acl.isAllowed(ifFalse, msg.sender));
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheIfThenElse(control, ifTrue, ifFalse);
        acl.allowTransient(result, msg.sender);
        db.fheIfThenElse(result, control, ifTrue, ifFalse);
    }
    function fheRand(bytes1 randType) external returns (uint256 result) {
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheRand(randType, 0);
        acl.allowTransient(result, msg.sender);
        db.fheRand(result, randType);
    }
    function fheRandBounded(uint256 upperBound, bytes1 randType) external returns (uint256 result) {
        result = FhevmLib(address(EXT_TFHE_LIBRARY)).fheRandBounded(upperBound, randType, 0);
        acl.allowTransient(result, msg.sender);
        db.fheRandBounded(result, upperBound, randType);
    }
    function cleanTransientStorage() external {}
}
