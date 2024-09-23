// tslint:disable-next-line no-implicit-dependencies

import { useEnvironment } from "./helpers";
import { isDeployed } from "../src/utils";
import { expect } from "chai";
import { ZAMA_DEV_NETWORK_CONFIG, ZAMA_DEV_NETWORK_NAME, ZamaDev } from "../src/constants";
import { getUserPackageNodeModulesDir, zamaReadContractAddressSync } from "../src/common/zamaContracts";
import { TASK_TEST } from "hardhat/builtin-tasks/task-names";

describe("zamadev erc20 tasks tests", function () {
  useEnvironment("zamadev-mock-erc20");

  it("Zamadev_ERC20: Check", async function () {
    this.hre.fhevm.logOptions = { quiet: true };
    expect(this.hre.network.config.chainId).is.eq(ZAMA_DEV_NETWORK_CONFIG.chainId);
    expect(this.hre.network.name).is.eq(ZAMA_DEV_NETWORK_NAME);
    expect(this.hre.network.config.mockFhevm).is.eq(false);
    expect(this.hre.network.config.useOnChainFhevmMockProcessor).is.eq(false);

    const signers = await this.hre.ethers.getSigners();
    // account #0 from ZamaDev default mnemonic
    expect(signers[0].address).to.eq("0xa5e1defb98EFe38EBb2D958CEe052410247F4c80");
    for (let i = 0; i < signers.length; ++i) {
      const balance = await this.hre.ethers.provider.getBalance(signers[i].address, "latest");
      expect(balance >= 0n).to.eq(true);
    }
    expect(ZamaDev.contracts["ACL"].fhevmAddress).is.eq(
      zamaReadContractAddressSync("ACL", getUserPackageNodeModulesDir(this.hre.config), ZamaDev),
    );
    const executorAddr = ZamaDev.contracts["TFHEExecutor"].fhevmAddress;
    expect(executorAddr).is.eq(
      zamaReadContractAddressSync("TFHEExecutor", getUserPackageNodeModulesDir(this.hre.config), ZamaDev),
    );
    const addr = await isDeployed(executorAddr, this.hre.ethers.provider);
    expect(executorAddr === addr).to.eq(true);
  });

  it("Zamadev_ERC20: TASK_TEST", async function () {
    this.hre.fhevm.logOptions = { quiet: true };
    expect(this.hre.network.config.mockFhevm).is.eq(false);
    expect(this.hre.network.config.useOnChainFhevmMockProcessor).is.eq(false);
    const [signer] = await this.hre.ethers.getSigners();
    // account #0 from ZamaDev default mnemonic
    expect(signer.address).to.eq("0xa5e1defb98EFe38EBb2D958CEe052410247F4c80");
    await this.hre.run(TASK_TEST);
  });
});
