// tslint:disable-next-line no-implicit-dependencies

import "../../../src/type-extensions";
import { runConfigAndTaskTest } from "../run-task-test";

const network = "localhost";
const fhevmType = "zama-mock";
const contract = "erc20";

/**
 * Does not work on anvil
 */
describe(`Test ${network}-${fhevmType}-${contract}`, runConfigAndTaskTest(network, fhevmType, contract));
