#!/bin/bash
MY_PATH="$(dirname -- "${BASH_SOURCE[0]}")"
PACKAGE_PATH="$(cd -- "${MY_PATH}/.." && pwd)" 

DIR=$(pwd);

cd ${PACKAGE_PATH}

${PACKAGE_PATH}/test/foundry/test.sh || { echo 'foundry test failed' ; cd $DIR ; exit 1; }
${PACKAGE_PATH}/test/run-task-test/hardhat/test.sh || { echo 'hardhat test failed' ; cd $DIR ; exit 1; }
${PACKAGE_PATH}/test/run-task-test/hardhat-node/test.sh || { echo 'hardhat-node test failed' ; cd $DIR ; exit 1; }
${PACKAGE_PATH}/test/run-task-test/anvil/test.sh || { echo 'anvil test failed' ; cd $DIR ; exit 1; }

cd ${DIR}
