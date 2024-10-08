#!/bin/bash
MY_PATH="$(dirname -- "${BASH_SOURCE[0]}")"
PACKAGE_PATH="$(cd -- "${MY_PATH}/../../.." && pwd)" 
TEST_PATH="${PACKAGE_PATH}/test"
DIR=$(pwd)

TEMPLATE_DIR="${TEST_PATH}/fixture-project-templates"
HARDHAT_NODE_NETWORK="hardhat";

abs_config_path() {
    local fhevmType="${1}";
    local contract="${2}";
    local configSrc="${TEMPLATE_DIR}/${contract}-project-template/${HARDHAT_NODE_NETWORK}-${fhevmType}.config.ts"

    echo ${configSrc}
}

kill_hardhat_node() {
    local abs_cfg_path=$(abs_config_path "${1}" "${2}")
    local PID=$(ps -ef | grep "${abs_cfg_path}" | grep -v grep | grep -v "test.sh" | awk '{print $2}')
    if [ -n "${PID}" ]; then
        kill $PID
        wait $PID 2>/dev/null
    fi
}

start_hardhat_node() {
    local abs_cfg_path=$(abs_config_path "${1}" "${2}")

    kill_hardhat_node "${1}" "${2}"

    cd ${PACKAGE_PATH}
    npx hardhat --config ${abs_cfg_path} node 2>&1 > /dev/null & 
}

run_test() {
    local fhevmType="${1}";
    local contract="${2}";
    local abs_test_path="${3}"

    start_hardhat_node "${fhevmType}" "${contract}"

    cd ${PACKAGE_PATH}
    npx mocha --exit --recursive "${abs_test_path}"
    local RESULT=$?

    kill_hardhat_node "${fhevmType}" "${contract}"

    cd ${DIR}

    return $RESULT
}


# eq: "npx hardhat --network localhost test"
run_test "zama-mock" "erc20" "${TEST_PATH}/run-task-test/hardhat-node/localhost-zama-mock-erc20.ci.test.ts" || { echo 'hardhat-node/localhost-zama-mock-erc20.ci.test.ts failed'; exit 1; }
run_test "zama-mock" "async-decrypt" "${TEST_PATH}/run-task-test/hardhat-node/localhost-zama-mock-async-decrypt.ci.test.ts" || { echo 'hardhat-node/localhost-zama-mock-async-decrypt.ci.test.ts failed'; exit 1; }
run_test "hh-fhevm" "erc20" "${TEST_PATH}/run-task-test/hardhat-node/localhost-hh-fhevm-erc20.ci.test.ts" || { echo 'hardhat-node/localhost-hh-fhevm-erc20.ci.test.ts failed'; exit 1; }
run_test "hh-fhevm" "async-decrypt" "${TEST_PATH}/run-task-test/hardhat-node/localhost-hh-fhevm-async-decrypt.ci.test.ts" || { echo 'hardhat-node/localhost-hh-fhevm-async-decrypt.ci.test.ts failed'; exit 1; }
