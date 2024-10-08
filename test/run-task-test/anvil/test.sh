#!/bin/bash
MY_PATH="$(dirname -- "${BASH_SOURCE[0]}")"
PACKAGE_PATH="$(cd -- "${MY_PATH}/../../.." && pwd)" 
TEST_PATH="${PACKAGE_PATH}"/test 

DIR=$(pwd);

rm -rf ${TEST_PATH}/tmp

kill_anvil() {
    PID=$(ps -ef | grep anvil | grep -v grep | grep -v "test.sh" | awk '{print $2}')
    if [ -n "${PID}" ]; then
        kill $PID
        # wait + anvil = freeze
    fi
}

restart_anvil() {
    kill_anvil
    anvil --silent &
}

run_test() {
    local abs_test_path="${1}"

    restart_anvil

    cd ${PACKAGE_PATH}
    npx mocha --exit --recursive "${abs_test_path}"
    local RESULT=$?

    kill_anvil

    cd ${DIR}

    return $RESULT
}

run_test "${TEST_PATH}/run-task-test/anvil/localhost-hh-fhevm-erc20.ci.test.ts" || { echo 'anvil/localhost-hh-fhevm-erc20.ci.test.ts failed'; exit 1; }
run_test "${TEST_PATH}/run-task-test/anvil/localhost-hh-fhevm-async-decrypt.ci.test.ts" || { echo 'anvil/localhost-hh-fhevm-async-decrypt.ci.test.ts failed'; exit 1; }
