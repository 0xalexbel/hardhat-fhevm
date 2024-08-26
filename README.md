# hardhat-fhevm

![test workflow](https://github.com/0xalexbel/hardhat-fhevm/actions/workflows/ci.yml/badge.svg)

A hardhat plugin to develop and test solidity programs using Zama's Fhevm.

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

## Tasks

to start a local fhevm node on port 8545:

```bash
npx hardhat fhevm start
```

to stop the node:

```bash
npx hardhat fhevm stop
```

to restart the node:

```bash
npx hardhat fhevm restart
```

to test your contracts in TFHE mock mode:

```bash
npx hardhat test
```

to test your contracts in using the local fhevm node:

```bash
npx hardhat --network fhevm test
```

to compile your contracts in TFHE mock mode:

```bash
npx hardhat compile
```
to compile your contracts in TFHE local mode:

```bash
npx hardhat --network fhevm compile
```

## Environment extensions

This plugin extends the Hardhat Runtime Environment by adding an `fhevm` field whose type is
`HardhatFhevmRuntimeEnvironment`.
