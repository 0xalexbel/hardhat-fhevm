// tslint:disable-next-line no-implicit-dependencies

import "../../../src/type-extensions";
import { runConfigAndTaskTest } from "../run-task-test";

const network = "localhost";
const fhevmType = "mock";
const contract = "async-decrypt";

describe(`Test ${network}-${fhevmType}-${contract}`, runConfigAndTaskTest(network, fhevmType, contract));
