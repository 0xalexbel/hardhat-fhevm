#!/bin/bash
MY_PATH="$(dirname -- "${BASH_SOURCE[0]}")"
PACKAGE_PATH="$(cd -- "${MY_PATH}/../.." && pwd)" 
TEST_PATH="${PACKAGE_PATH}/test/foundry"

DIR=$(pwd);

cd ${PACKAGE_PATH}

npx mocha --exit --recursive "${TEST_PATH}/foundry-erc20.test.ts" || { echo 'foundry/foundry-erc20.ci.test.ts failed'; exit 1; }

cd ${DIR}

