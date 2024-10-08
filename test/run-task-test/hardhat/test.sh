#!/bin/bash

MY_PATH="$(dirname -- "${BASH_SOURCE[0]}")"
PACKAGE_PATH="$(cd -- "${MY_PATH}/../../.." && pwd)" 

DIR=$(pwd);

cd ${PACKAGE_PATH}

npx mocha --exit --recursive 'test/**/hardhat/hardhat-*.ci.test.ts'
RESULT=$?

cd ${DIR}

exit $RESULT