# hardhat-fhevm

![test workflow](https://github.com/0xalexbel/hardhat-fhevm/actions/workflows/ci.yml/badge.svg)

A hardhat plugin to develop and test solidity programs using Zama's Fhevm. 
- Add Anvil/Hardhat node support.
- Add Foundry/Forge support.

## Installation

```bash
npm install --save-dev hardhat-fhevm
```

Import the plugin in your `hardhat.config.js`:

```js
require("hardhat-fhevm");
```

Or if you are using TypeScript, in your `hardhat.config.ts`:

```ts
import "hardhat-fhevm";
```

## Required packages

- [fhevm: 0.5.8](https://github.com/zama-ai/fhevm)
- [fhevmjs: 0.5.2](https://github.com/zama-ai/fhevmjs)

# Tasks

### `npx hardhat local-fhevm start`

To start a local fhevm node on port 8545:

```bash
npx hardhat local-fhevm start
```

### `npx hardhat local-fhevm stop`

To stop any running local fhevm node:

```bash
npx hardhat local-fhevm stop
```

### `npx hardhat local-fhevm restart`

```bash
npx hardhat local-fhevm restart
```

### To configure the `local-fhevm` node

From the `hardhat.config.ts` file, you can setup the local fhevm node options using the `fhevmNode` property

```ts
const config: HardhatUserConfig = {
  ...
  fhevmNode: {
    wsPort: 8546,
    httpPort: 9545,
    gatewayRelayerPrivateKey: "7ec931411ad75a7c201469a385d6f18a325d4923f9f213bd882bbea87e160b67",
  },
  ...
}
```

### `npx hardhat fhevm clean`

To stop any running local fhevm node and deleting related cache directories.

```bash
# This command will stop any running fhevm node and delete the local fhevm cache directory
npx hardhat fhevm clean
```

# Test

To test your contracts in TFHE mock mode:

```bash
npx hardhat --network hardhat test
```

To test your contracts in using the local fhevm node:

```bash
# Note that the local node is automatically started if it is not yet running
npx hardhat --network fhevm test
```

To test your contracts in using Hardhat node or Anvil:

```bash
# Start a fresh new anvil server
anvil
```

Then run your tests using the `--network localhost` option.

```bash
npx hardhat --network localhost test
```

# Deploying an fhevm environment on a standalone eth node

### Using Anvil

To setup a standalone anvil node with a mock fhevm pre-installed:

```bash
# From one terminal : 🚀 start a fresh new anvil node
anvil
# From a second terminal : deploy a new mock fhevm framework
npx hardhat --network localhost fhevm setup
# ✅ localhost is now ready to go!
```

### Using Hardhat node

To setup a standalone hardhat node with a mock fhevm pre-installed:

```bash
# From one terminal : 🚀 start a fresh new hardhat node
npx hardhat node
# From a second terminal : deploy a new mock fhevm framework
npx hardhat --network localhost fhevm setup
# ✅ localhost is now ready to go!
```

to compile your contracts in TFHE mock mode:

```bash
npx hardhat --network hardhat compile
```
to compile your contracts in TFHE local mode:

```bash
npx hardhat --network fhevm compile
```

# Using Forge

To setup a fhevm+foundry environment, type:

```bash
npx hardhat fhevm init-foundry
```

If you already have a foundry.toml file, you must manually add the following remappings.

```toml
remappings = [
    "forge-fhevm=hh-fhevm/contracts/forge-fhevm",
    "fhevm/lib=hh-fhevm/contracts/fhevm/lib",
    "fhevm/gateway=hh-fhevm/contracts/fhevm/gateway",
]
```

### Example

```ts
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {console} from "forge-std/console.sol";
import {TFHE, euint8} from "fhevm/lib/TFHE.sol";

import {fhevm} from "forge-fhevm/fhevm.sol";
import {FhevmScript} from "forge-fhevm/FhevmScript.sol";

contract Test is FhevmScript {
    function run() public {
        euint8 a = TFHE.asEuint8(255);
        euint8 b = TFHE.asEuint8(1);
        euint8 c = TFHE.add(a, b);

        uint8 clear_c = fhevm.decrypt8Unchecked(c);
    }
}
```

### Use artithmetic checking (forge only)

The `hardhat-fhevm` plugin comes with a custom mock fhevm that offers a few debug helpers including arithmetic checking (overflow, underflow and division by zero). 
Arithmetic checking is performed on-demand and must be activated using the following functions:

When enabled, the default mode is `ArithmeticCheckingMode.Operands`. The checking is only performed on operands. When using the `ArithmeticCheckingMode.OperandsAndResult` mode
the checking is performed on both operands and operator result.

```ts
// Between those 2 calls, any TFHE binary op causing Overflow, underflow or division by zero 
// will automatically revert with a custom error
fhevm.startCheckArithmetic()
...
fhevm.stopCheckArithmetic()
```

```ts
euint64 a = erc20.balanceOf(alice);
euint64 b = erc20.balanceOf(bob);

// suppose:
// 1. a > b,
// 2. you want to make sure the result of b-a is valid (there is no underflow).

// Without arithmetic checking
// the call below will NOT revert and c will contain an invalid integer
euint64 c = TFHE.sub(b, a);

// With arithmetic checking enabled
fhevm.checkArithmetic(ArithmeticCheckingMode.OperandsAndResult)
// the call below will revert with an underflow error
// because the result of b-a is invalid.
TFHE.sub(b, a);
```

## Environment extensions

This plugin extends the Hardhat Runtime Environment by adding an `fhevm` field whose type is
`HardhatFhevmRuntimeEnvironment`.
