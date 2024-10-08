import assert from "assert";
import fs from "fs";
import path from "path";
import { ethers as EthersT } from "ethers";
import { FhevmContractsConfig, HardhatFhevmEthers } from "./types";
import { walletFromMnemonic } from "./utils/wallet";
import { deployContract } from "./utils/eth_utils";
import { HardhatFhevmError } from "../error";

export async function ____deployAndRunGatewayFirstRequestBugAvoider(
  config: FhevmContractsConfig,
  provider: EthersT.Provider | null,
  heth: HardhatFhevmEthers,
) {
  const deployer = walletFromMnemonic(
    config.deployer.accounts.fhevm.accountIndex,
    config.deployer.mnemonic,
    config.deployer.path,
    provider,
  );

  const contract = await deployContract("GatewayFirstRequestBugAvoider", [], deployer, heth);

  const address = await contract.getAddress();
  // In Local mode the MockedPrecompile.sol contract is not deployed!
  // nonce = nextNonce - 1
  const expectedAddr = EthersT.getCreateAddress({
    from: deployer.address,
    nonce: config.deployer.accounts.fhevm.nextNonce - 1,
  });

  if (address !== expectedAddr) {
    throw new HardhatFhevmError("Unexpected GatewayFirstRequestBugAvoider contract address (wrong nonce ??)");
  }

  /* eslint-disable @typescript-eslint/ban-ts-comment */
  //@ts-ignore
  const tx = await contract.connect(deployer).requestUint8({ gasLimit: 5_000_000 });
  await tx.wait(1);
}

export function ____writeGatewayFirstRequestBugAvoiderSync(filePath: string, solidityVersion: string) {
  const solidityTemplate = `// SPDX-License-Identifier: BSD-3-Clause-Clear
  
  pragma solidity ^${solidityVersion};
  
  import {TFHE, euint8} from "fhevm/lib/TFHE.sol";
  import {GatewayCaller} from "fhevm/gateway/GatewayCaller.sol";
  import {Gateway} from "fhevm/gateway/lib/Gateway.sol";
  
  contract GatewayFirstRequestBugAvoider is GatewayCaller {
      euint8 xUint8;
  
      uint8 public yUint8;
  
      uint256 public latestRequestID;
  
      constructor() {
          xUint8 = TFHE.asEuint8(42);
          TFHE.allow(xUint8, address(this));
      }
  
      function requestUint8() public {
          uint256[] memory cts = new uint256[](1);
          cts[0] = Gateway.toUint256(xUint8);
          Gateway.requestDecryption(cts, this.callbackUint8.selector, 0, block.timestamp + 100, false);
      }
  
      function callbackUint8(uint256, uint8 decryptedInput) public onlyGateway returns (uint8) {
          yUint8 = decryptedInput;
          return decryptedInput;
      }
  }\n`;

  try {
    assert(path.isAbsolute(filePath));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, solidityTemplate, {
      encoding: "utf8",
      flag: "w",
    });
  } catch (err) {
    throw new HardhatFhevmError(`Failed to generate '${filePath}' file: ${err}`);
  }
}
