// tslint:disable-next-line no-implicit-dependencies

import "../../../src/type-extensions";
import { runTaskTestOnly } from "../run-task-test";

const network = "fhevm";
const fhevmType = "native";
const contract = "erc20";

describe(`Test ${network}-${fhevmType}-${contract}`, runTaskTestOnly(network, fhevmType, contract));
