// tslint:disable-next-line no-implicit-dependencies

import "../../../src/type-extensions";
import { runConfigAndTaskTest } from "../run-task-test";

const network = "localhost";
const fhevmType = "hh-fhevm";
const contract = "erc20";

describe(`Test ${network}-${fhevmType}-${contract}`, runConfigAndTaskTest(network, fhevmType, contract));
