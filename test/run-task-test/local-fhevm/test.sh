#!/bin/bash
MY_PATH="$(dirname -- "${BASH_SOURCE[0]}")"
PACKAGE_PATH="$(cd -- "${MY_PATH}/../../.." && pwd)" 
TEST_PATH="${PACKAGE_PATH}/test"
DIR=$(pwd)

run_test() {
    local abs_test_path="${1}"

    rm -rf ${TEST_PATH}/tmp

    cd ${PACKAGE_PATH}
    
    npx mocha --exit --recursive "${abs_test_path}"
    local RESULT=$?

    rm -rf ${TEST_PATH}/tmp

    cd ${DIR}

    return $RESULT
}

run_test "${TEST_PATH}/run-task-test/local-fhevm/fhevm-native-erc20.local.test.ts" || { echo 'local-fhevm/fhevm-native-erc20.local.test.ts failed'; exit 1; }
run_test "${TEST_PATH}/run-task-test/local-fhevm/fhevm-native-async-decrypt.local.test.ts" || { echo 'local-fhevm/fhevm-native-async-decrypt.local.test.ts failed'; exit 1; }
