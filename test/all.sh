#!/bin/bash
MY_PATH="$(dirname -- "${BASH_SOURCE[0]}")"
PACKAGE_PATH="$(cd -- "${MY_PATH}/.." && pwd)" 

DIR=$(pwd);

cd ${PACKAGE_PATH}

# run all ci tests
${PACKAGE_PATH}/test/all.ci.sh || { echo 'ci test failed' ; cd $DIR ; exit 1; }

# local-fhevm tests are very slow.
${PACKAGE_PATH}/test/run-task-test/local-fhevm/test.sh || { echo 'local-fhevm test failed' ; cd $DIR ; exit 1; }

cd ${DIR}
