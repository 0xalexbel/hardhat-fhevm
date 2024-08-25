# hardhat-fhevm

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

This plugin adds the following tasks:
- fhevm start : to start a local dev node
- fhevm stop : to stop a local dev node
- fhevm restart : to restart a local dev node

This plugin overrides the standard `test` task by automatically setting up a fhevm environment.
