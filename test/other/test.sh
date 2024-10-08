#!/bin/bash
MY_PATH="$(dirname -- "${BASH_SOURCE[0]}")"
PACKAGE_PATH="$(cd -- "${MY_PATH}/../.." && pwd)" 
TEST_PATH="${PACKAGE_PATH}/test/other"

DIR=$(pwd);

cd ${PACKAGE_PATH}

npx mocha --exit --recursive "${TEST_PATH}/empty-test.ts" || { echo 'other/empty-test.ts failed'; exit 1; }

cd ${DIR}

