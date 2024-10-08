// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/*
    uint8 internal constant ebool_t = 0;
    uint8 internal constant euint4_t = 1;
    uint8 internal constant euint8_t = 2;
    uint8 internal constant euint16_t = 3;
    uint8 internal constant euint32_t = 4;
    uint8 internal constant euint64_t = 5;
    uint8 internal constant euint128_t = 6;
    uint8 internal constant euint160_t = 7;
    uint8 internal constant euint256_t = 8;
    uint8 internal constant ebytes64_t = 9;
    uint8 internal constant ebytes128_t = 10;
    uint8 internal constant ebytes256_t = 11;
*/

contract TFHEExecutorDB {

    enum ArithmeticCheckingMode {
        OperandsOnly,
        OperandsAndResult
    }

    error HandleDoesNotExist(uint256 handle);
    error ArithmeticOverflow(uint256 handle);
    error ArithmeticUnderflow(uint256 handle);
    error ArithmeticDivisionByZero(uint256 handle);

    uint256[9] private MAX_UINT = [
        1, // 2**1 - 1 (0, ebool_t)
        0xF, // 2**4 - 1 (1, euint4_t)
        0xFF, // 2**8 - 1 (2, euint8_t)
        0xFFFF, // 2**16 - 1 (3, euint16_t)
        0xFFFFFFFF, // 2**32 - 1 (4, euint32_t)
        0xFFFFFFFFFFFFFFFF, // 2**64 - 1 (5, euint64_t)
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF, // 2**128 - 1 (6, euint128_t))
        0x00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF, // 2**160 - 1 (7, euint160_t))
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF // 2**256 - 1 (8, euint256_t))
    ];

    struct Entry256 {
        // equals to Common.<type> + 1
        uint8 valueType;
        uint256 value;
        bool divisionByZero;
        bool overflow;
        bool underflow;
        bool trivial;
    }

    struct Entry2048 {
        // equals to Common.<type> + 1
        uint8 valueType;
        uint256 value1;
        uint256 value2;
        uint256 value3;
        uint256 value4;
    }
    
    mapping(uint256 => Entry256) public db_256;
    mapping(uint256 => Entry2048) public db_2048;

    uint256 public db256Count;
    uint256 public db2048Count;

    uint256 private _throwIfArithmeticError;
    ArithmeticCheckingMode private _arithmeticCheckingMode;

    function exists256(uint256 handle) internal view returns (bool) {
        return db_256[handle].valueType > 0;
    }
    function exists2048(uint256 handle) internal view returns (bool) {
        return db_2048[handle].valueType > 0;
    }

    function get256(uint256 handle) public view returns (Entry256 memory) {
        return db_256[handle];    
    }
    function get2048(uint256 handle) public view returns (Entry2048 memory) {
        return db_2048[handle];    
    }

    function startCheckArithmetic() public {
        require(_throwIfArithmeticError == 0, "Arithmetic error checking already setup");
        _throwIfArithmeticError = type(uint256).max;
        _arithmeticCheckingMode = ArithmeticCheckingMode.OperandsOnly;
    }

    function startCheckArithmetic(uint8 mode) public {
        require(_throwIfArithmeticError == 0, "Arithmetic error checking already setup");
        _throwIfArithmeticError = type(uint256).max;
        _arithmeticCheckingMode = ArithmeticCheckingMode(mode);
    }

    function stopCheckArithmetic() public {
        _throwIfArithmeticError = 0;
    }

    function checkArithmetic() public {
        require(_throwIfArithmeticError == 0, "Arithmetic error checking already setup");
        _throwIfArithmeticError = 1;
        _arithmeticCheckingMode = ArithmeticCheckingMode.OperandsOnly;
    }

    function checkArithmetic(uint8 mode) public {
        require(_throwIfArithmeticError == 0, "Arithmetic error checking already setup");
        _throwIfArithmeticError = 1;
        _arithmeticCheckingMode = ArithmeticCheckingMode(mode);
    }

    /**
     * @dev Throws if handle is not stored in the db 256.
     */
    modifier onlyExists256(uint256 handle) {
        if (db_256[handle].valueType == 0) {
            revert HandleDoesNotExist(handle);
        }
        _;
    }

    /**
     * @dev Throws if handle is not a scalar and is not stored in the db 256.
     */
    modifier onlyExistsOrScalar256(uint256 handle, bytes1 scalarByte) {
        if (!(scalarByte == 0x01 || db_256[handle].valueType > 0)) {
            revert HandleDoesNotExist(handle);
        }
        _;
    }

    function typeOf(uint256 handle) internal pure returns (uint8) {
        uint8 typeCt = uint8(handle >> 8);
        return typeCt;
    }

    function _newEntry256(uint256 lhs, uint256 rhs) internal view returns (Entry256 memory) {
        Entry256 memory l = db_256[lhs];
        Entry256 memory r = db_256[rhs];
        Entry256 memory e;
        e.overflow = l.overflow || r.overflow;
        e.underflow = l.underflow || r.underflow;
        e.divisionByZero = l.divisionByZero || r.divisionByZero;
        return e;
    }

    function revertIfArithmeticError(uint256 handle) internal view {
        Entry256 memory e = db_256[handle];
        if (e.overflow) {
            revert ArithmeticOverflow(handle);
        }
        if (e.underflow) {
            revert ArithmeticUnderflow(handle);
        }
        if (e.divisionByZero) {
            revert ArithmeticDivisionByZero(handle);
        }
    }

    function verifyHandle256(uint256 ct, bytes1 scalarByte, bool operand) internal view returns (uint256 clearCt) {
        Entry256 memory ctEntry = db_256[ct];
        if (scalarByte == 0x0) {
            if (ctEntry.valueType == 0) {
                revert HandleDoesNotExist(ct);
            }
            if (operand || (!operand && _arithmeticCheckingMode == ArithmeticCheckingMode.OperandsAndResult)) {
                if (_throwIfArithmeticError > 0) {
                    revertIfArithmeticError(ct);
                }
            }
            clearCt = ctEntry.value;
        } else {
            clearCt = ct;
        }
    }

    function binaryOpVerify256(uint256 lhs, uint256 rhs, bytes1 scalarByte) internal view returns (uint256 clearLhs, uint256 clearRhs) {
        clearLhs = verifyHandle256(lhs, 0x0, true);
        clearRhs = verifyHandle256(rhs, scalarByte, true);
    }

    function ternaryOpVerify256(uint256 one, uint256 two, uint256 three) internal view returns (uint256 clearOne, uint256 clearTwo, uint256 clearThree) {
        clearOne = verifyHandle256(one, 0x0, true);
        clearTwo = verifyHandle256(two, 0x0, true);
        clearThree = verifyHandle256(three, 0x0, true);
    }

    function exit_insertDB256(uint256 handle, Entry256 memory e) internal {
        // Does not already exist
        if (db_256[handle].valueType == 0) {
            db256Count++;
        }
        db_256[handle] = e;

        if (_throwIfArithmeticError > 0) {
            if (_arithmeticCheckingMode == ArithmeticCheckingMode.OperandsAndResult) {
                revertIfArithmeticError(handle);
            }
            _throwIfArithmeticError--;
        }
    }

    function insertDB2048(uint256 handle, Entry2048 memory e) internal {
        // Does not already exist
        if (db_2048[handle].valueType == 0) {
            db2048Count++;
        }
        db_2048[handle] = e;
    }

    function fheAdd(
        uint256 resultHandle,
        uint256 lhs,
        uint256 rhs,
        bytes1 scalarByte
    ) external {
        uint8 lhsType = typeOf(lhs);

        require(lhsType <= 8);
        require(lhsType == typeOf(resultHandle));

        (uint256 clearLhs, uint256 clearRhs) = binaryOpVerify256(lhs, rhs, scalarByte);
    
        Entry256 memory e = _newEntry256(lhs, rhs);
        e.valueType = lhsType + 1;
        (bool succeeded, uint256 result) = Math.tryAdd(clearLhs, clearRhs);
        e.value = result % (MAX_UINT[lhsType] + 1);
        e.overflow = (succeeded ? (result > MAX_UINT[lhsType]) : true) || e.overflow;

        // Must be the very last function call
        exit_insertDB256(resultHandle, e);
    }

    function fheSub(
        uint256 resultHandle,
        uint256 lhs,
        uint256 rhs,
        bytes1 scalarByte
    ) external {
        uint8 lhsType = typeOf(lhs);

        require(lhsType <= 8);
        require(lhsType == typeOf(resultHandle));

        (uint256 clearLhs, uint256 clearRhs) = binaryOpVerify256(lhs, rhs, scalarByte);

        Entry256 memory e = _newEntry256(lhs, rhs);
        e.valueType = lhsType + 1;
        e.underflow = (clearRhs > clearLhs) || e.underflow;
        unchecked {
            e.value = (clearLhs - clearRhs) % (MAX_UINT[lhsType] + 1);    
        }

        // Must be the very last function call
        exit_insertDB256(resultHandle, e);
    }

    function fheMul(
        uint256 /* resultHandle */,
        uint256 /* lhs */,
        uint256 /* rhs */,
        bytes1 /* scalarByte */
    ) external pure returns (uint256 /*result*/) {
        revert("fheMul not yet implemented");
    }

    function fheDiv(
        uint256 /* resultHandle */,
        uint256 /* lhs */,
        uint256 /* rhs */,
        bytes1 /* scalarByte */
    ) external pure returns (uint256 /*result*/) {
        revert("fheDiv not yet implemented");
    }

    function fheRem(
        uint256 /* resultHandle */,
        uint256 /* lhs */,
        uint256 /* rhs */,
        bytes1 /* scalarByte */
    ) external pure returns (uint256 /*result*/) {
        revert("fheRem not yet implemented");
    }

    function fheBitAnd(
        uint256 resultHandle,
        uint256 lhs,
        uint256 rhs,
        bytes1 scalarByte
    ) external {
        uint8 lhsType = typeOf(lhs);

        require(lhsType <= 8);
        require(typeOf(resultHandle) == 0);

        (uint256 clearLhs, uint256 clearRhs) = binaryOpVerify256(lhs, rhs, scalarByte);
    
        Entry256 memory e = _newEntry256(lhs, rhs);
        e.valueType = lhsType + 1;
        e.value = (clearLhs & clearRhs);

        // Must be the very last function call
        exit_insertDB256(resultHandle, e);
    }

    function fheBitOr(
        uint256 resultHandle,
        uint256 lhs,
        uint256 rhs,
        bytes1 scalarByte
    ) external {
        uint8 lhsType = typeOf(lhs);

        require(lhsType <= 8);
        require(typeOf(resultHandle) == 0);

        (uint256 clearLhs, uint256 clearRhs) = binaryOpVerify256(lhs, rhs, scalarByte);
   
        Entry256 memory e = _newEntry256(lhs, rhs);
        e.valueType = lhsType + 1;
        e.value = (clearLhs | clearRhs);

        // Must be the very last function call
        exit_insertDB256(resultHandle, e);
    }

    function fheBitXor(
        uint256 /* resultHandle */,
        uint256 /* lhs */,
        uint256 /* rhs */,
        bytes1 /* scalarByte */
    ) external pure returns (uint256 /*result*/) {
        revert("fheBitXor not yet implemented");
    }

    function fheShl(
        uint256 /* resultHandle */,
        uint256 /* lhs */,
        uint256 /* rhs */,
        bytes1 /* scalarByte */
    ) external pure returns (uint256 /*result*/) {
        revert("fheShl not yet implemented");
    }

    function fheShr(
        uint256 /* resultHandle */,
        uint256 /* lhs */,
        uint256 /* rhs */,
        bytes1 /* scalarByte */
    ) external pure returns (uint256 /*result*/) {
        revert("fheShr not yet implemented");
    }

    function fheRotl(
        uint256 /* resultHandle */,
        uint256 /* lhs */,
        uint256 /* rhs */,
        bytes1 /* scalarByte */
    ) external pure returns (uint256 /*result*/) {
        revert("fheRotl not yet implemented");
    }

    function fheRotr(
        uint256 /* resultHandle */,
        uint256 /* lhs */,
        uint256 /* rhs */,
        bytes1 /* scalarByte */
    ) external pure returns (uint256 /*result*/) {
        revert("fheRotl not yet implemented");
    }

    function fheEq(
        uint256 resultHandle,
        uint256 lhs,
        uint256 rhs,
        bytes1 scalarByte
    ) external {
        uint8 lhsType = typeOf(lhs);

        require(lhsType <= 8);
        require(typeOf(resultHandle) == 0);

        (uint256 clearLhs, uint256 clearRhs) = binaryOpVerify256(lhs, rhs, scalarByte);
    
        Entry256 memory e = _newEntry256(lhs, rhs);
        e.valueType = lhsType + 1;
        e.value = (clearLhs == clearRhs) ? 1 : 0;

        // Must be the very last function call
        exit_insertDB256(resultHandle, e);
    }

    function fheNe(
        uint256 resultHandle,
        uint256 lhs,
        uint256 rhs,
        bytes1 scalarByte
    ) external {
        uint8 lhsType = typeOf(lhs);

        require(lhsType <= 8);
        require(typeOf(resultHandle) == 0);

        (uint256 clearLhs, uint256 clearRhs) = binaryOpVerify256(lhs, rhs, scalarByte);
   
        Entry256 memory e = _newEntry256(lhs, rhs);
        e.valueType = lhsType + 1;
        e.value = (clearLhs != clearRhs) ? 1 : 0;

        // Must be the very last function call
        exit_insertDB256(resultHandle, e);
    }

    function fheGe(
        uint256 resultHandle,
        uint256 lhs,
        uint256 rhs,
        bytes1 scalarByte
    ) external {
        uint8 lhsType = typeOf(lhs);

        require(lhsType <= 8);
        require(typeOf(resultHandle) == 0);

        (uint256 clearLhs, uint256 clearRhs) = binaryOpVerify256(lhs, rhs, scalarByte);
    
        Entry256 memory e = _newEntry256(lhs, rhs);
        e.valueType = lhsType + 1;
        e.value = (clearLhs >= clearRhs) ? 1 : 0;

        // Must be the very last function call
        exit_insertDB256(resultHandle, e);
    }

    function fheGt(
        uint256 resultHandle,
        uint256 lhs,
        uint256 rhs,
        bytes1 scalarByte
    ) external {
        uint8 lhsType = typeOf(lhs);

        require(lhsType <= 8);
        require(typeOf(resultHandle) == 0);

        (uint256 clearLhs, uint256 clearRhs) = binaryOpVerify256(lhs, rhs, scalarByte);
    
        Entry256 memory e = _newEntry256(lhs, rhs);
        e.valueType = lhsType + 1;
        e.value = (clearLhs > clearRhs) ? 1 : 0;

        // Must be the very last function call
        exit_insertDB256(resultHandle, e);
    }

    function fheLe(
        uint256 resultHandle,
        uint256 lhs,
        uint256 rhs,
        bytes1 scalarByte
    ) external {
        uint8 lhsType = typeOf(lhs);

        require(lhsType <= 8);
        require(typeOf(resultHandle) == 0);

        (uint256 clearLhs, uint256 clearRhs) = binaryOpVerify256(lhs, rhs, scalarByte);
    
        Entry256 memory e = _newEntry256(lhs, rhs);
        e.valueType = lhsType + 1;
        e.value = (clearLhs <= clearRhs) ? 1 : 0;

        // Must be the very last function call
        exit_insertDB256(resultHandle, e);
    }

    function fheLt(
        uint256 resultHandle,
        uint256 lhs,
        uint256 rhs,
        bytes1 scalarByte
    ) external {
        uint8 lhsType = typeOf(lhs);

        require(lhsType <= 8);
        require(typeOf(resultHandle) == 0);

        (uint256 clearLhs, uint256 clearRhs) = binaryOpVerify256(lhs, rhs, scalarByte);

        Entry256 memory e = _newEntry256(lhs, rhs);
        e.valueType = lhsType + 1;
        e.value = (clearLhs < clearRhs) ? 1 : 0;

        // Must be the very last function call
        exit_insertDB256(resultHandle, e);
    }

    function fheMin(
        uint256 /* resultHandle */,
        uint256 /* lhs */,
        uint256 /* rhs */,
        bytes1 /* scalarByte */
    ) external pure returns (uint256 /*result*/) {
        revert("fheMin not yet implemented");
    }

    function fheMax(
        uint256 /* resultHandle */,
        uint256 /* lhs */,
        uint256 /* rhs */,
        bytes1 /* scalarByte */
    ) external pure returns (uint256 /*result*/) {
        revert("fheMax not yet implemented");
    }

    function fheNeg(uint256 /* resultHandle */, uint256 /* ct */) external pure returns (uint256 /*result*/) {
        revert("fheNeg not yet implemented");
    }

    function fheNot(uint256 resultHandle, uint256 ct) external {
        uint8 ctType = typeOf(ct);
        uint256 clearCt = verifyHandle256(ct, 0x0, true);

        require(ctType <= 8);

        Entry256 memory ctEntry = db_256[ct];

        Entry256 memory e;
        e.overflow = ctEntry.overflow;
        e.underflow = ctEntry.underflow;
        e.divisionByZero = ctEntry.divisionByZero;
        e.valueType = ctType + 1;
        e.value = (clearCt ^ type(uint256).max) & MAX_UINT[ctType];

        // Must be the very last function call
        exit_insertDB256(resultHandle, e);
    }

    function bytesToBytes1(bytes memory b, uint offset) private pure returns (bytes1) {
        return bytes1(b[offset] & 0xFF);
    }

    function bytesToBytes2(bytes memory b, uint offset) private pure returns (bytes2) {
        bytes2 out = bytes2(b[offset + 0] & 0xFF);
        out |= bytes2(b[offset + 1] & 0xFF) >> (1 * 8);
        return out;
    }

    function bytesToBytes8(bytes memory b, uint offset) private pure returns (bytes8) {
        bytes8 out;

        for (uint i = 0; i < 8; i++) {
            out |= bytes8(b[offset + i] & 0xFF) >> (i * 8);
        }
        return out;
    }

    function verifyCiphertext(
        uint256 resultHandle,
        bytes32 inputHandle,
        address /*callerAddress*/,
        bytes memory inputProof,
        bytes1 inputType
    ) external {
        // extract index in proof
        uint256 indexHandle = uint256((inputHandle & 0x0000000000000000000000000000000000000000000000000000000000ff0000) >> 16);
        require(indexHandle == 0, "indexHandle greater than zero are not yet supported");

        // extract handle type
        uint8 typeCt = uint8(inputProof[0]);
        require(uint8(inputType) == typeCt, "verifyCiphertext: incompatible types");
        require(typeCt == 5 || typeCt == 0, "Only uint64 and bool are supported");

        Entry256 memory e;
        e.valueType = typeCt + 1;

        if (typeCt == 0) {
            e.value = uint256(uint8(bytesToBytes1(inputProof, 1)));
        } else if (typeCt == 5) {
            e.value = uint256(uint64(bytesToBytes8(inputProof, 1)));
        }

        // Must be the very last function call
        exit_insertDB256(resultHandle, e);
    }

    function cast(
        uint256 /* resultHandle */,
        uint256 /* ct */,
        bytes1 /* toType */
    ) external pure returns (uint256 /* result */) {
        revert("cast not yet implemented");
    }

    function trivialEncrypt(
        uint256 resultHandle,
        uint256 plaintext,
        bytes1 toType
    ) external {
        uint8 toT = uint8(toType);
       
        require(toT <= 8, "Unsupported type");
        require(plaintext <= MAX_UINT[toT], "Value overflow");

        Entry256 memory e;
        e.valueType = toT + 1;
        e.value = plaintext;
        e.trivial = true;

        // Must be the very last function call
        exit_insertDB256(resultHandle, e);
    }

    function fheIfThenElse(
        uint256 resultHandle,
        uint256 control,
        uint256 ifTrue,
        uint256 ifFalse
    ) external {
        (uint256 clearControl,,) = ternaryOpVerify256(control, ifTrue, ifFalse);

        Entry256 memory e;
        Entry256 memory c = (clearControl == 0) ? db_256[ifFalse] : db_256[ifTrue];

        e.valueType = c.valueType;
        e.value = c.value;
        e.trivial = c.trivial;
        e.overflow = c.overflow;
        e.underflow = c.underflow;
        e.divisionByZero = c.divisionByZero;

        // Must be the very last function call
        exit_insertDB256(resultHandle, e);
    }

    function fheRand(uint256 /* resultHandle */, bytes1 /* randType */) external pure returns (uint256 /* result */) {
        revert("fheRand not yet implemented");
    }

    function fheRandBounded(
        uint256 /* resultHandle */,
        uint256 /* upperBound */,
        bytes1 /* randType */
    ) external pure returns (uint256 /* result */) {
        revert("fheRandBounded not yet implemented");
    }

    function cleanTransientStorage() external {}
}
