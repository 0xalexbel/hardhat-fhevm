import dotenv from "dotenv";
import assert from "assert";
import fs from "fs";
import fsExt from "fs-extra";
import path, { resolve } from "path";
import { ethers as EthersT } from "ethers";

import { walletFromMnemonic } from "./utils/wallet";
import { Artifact, Artifacts } from "hardhat/types";
import { HardhatFhevmError } from "../error";
import { getLibDirname, getHHFhevmPackageSolidityOverridesDir } from "./utils/dirs";
import { restoreBackupFileSync, writeFileWithBackupSync } from "./utils/fs_utils";
import { rimrafSync } from "rimraf";
import { EXT_TFHE_LIBRARY } from "../constants";
import {
  FhevmContractName,
  HardhatFhevmEthers,
  FhevmDeployOptions,
  FhevmContractConfig,
  FhevmContractsConfig,
} from "./types";
import { ZamaDevExtraContractsToCompile, ZamaDevOverrides } from "./fhevm-config";
import { splitFullyQualifiedName } from "./utils/eth_utils";
import { listFhevmContractsInDeployOrder } from "./utils/config_utils";

export class FhevmContractsRepository {
  private _repoParentDir: string;
  private _config: FhevmContractsConfig;

  constructor(repoParentDir: string, config: FhevmContractsConfig) {
    this._config = config;
    this._repoParentDir = getLibDirname(repoParentDir, config, false /* check */);
  }

  public get config() {
    return this._config;
  }

  public get parentDir() {
    return this._repoParentDir;
  }

  public get libDir() {
    return path.join(this._repoParentDir, this.libName);
  }

  public get libName() {
    return this._config.libName;
  }

  public resolvePath(p: string) {
    return path.join(this._repoParentDir, p);
  }

  public getFullyQualifiedName(contractName: FhevmContractName) {
    return this._config.contracts[contractName].fullyQualifiedName;
  }

  public getSolidityPath(contractName: FhevmContractName) {
    const p = this._config.contracts[contractName].fullyQualifiedName.split(":").at(0);
    assert(p);
    return this.resolvePath(p);
  }

  public getDeployerWallet(contractName: FhevmContractName, provider: EthersT.Provider | null) {
    return walletFromMnemonic(
      this._config.deployer.accounts[this._config.contracts[contractName].deployer].accountIndex,
      this._config.deployer.mnemonic,
      this._config.deployer.path,
      provider,
    );
  }

  public getOwnerWallet(contractName: FhevmContractName, provider: EthersT.Provider | null) {
    if (this._config.contracts[contractName].owner === undefined) {
      return undefined;
    }
    return walletFromMnemonic(
      this._config.deployer.accounts[this._config.contracts[contractName].owner].accountIndex,
      this._config.deployer.mnemonic,
      this._config.deployer.path,
      provider,
    );
  }

  // cfg only
  public readAddressSync(contractName: FhevmContractName): string | undefined {
    return this.readAddressFromSolidityFileSync(contractName);
  }

  /**
   * Parse contract address stored in env file.
   * Example: Parse `fhevm/lib/.env.acl` to retreive `ACL` address
   * Always returns a checksum address
   */
  public readAddressFromEnvFileSync(contractName: FhevmContractName): string | undefined {
    const c = this._config.contracts[contractName];
    if (!c.envVar) {
      return undefined;
    }
    const p = this.resolvePath(c.envVar.dotenvPath);
    const e = c.envVar.name;
    if (!e) {
      throw new HardhatFhevmError(`Missing contact ${contractName} env var name`);
    }

    try {
      const parsedEnv = dotenv.parse(fs.readFileSync(p));
      return EthersT.getAddress(parsedEnv[e]);
    } catch {
      return undefined;
    }
  }

  /**
   * Parse contract address stored in address solidity file.
   * Example: Parse `fhevm/gateway/lib/GatewayContractAddress.sol` to retreive `GatewayContract` address
   * Always returns a checksum address
   */
  public readAddressFromSolidityFileSync(contractName: FhevmContractName): string | undefined {
    const c = this._config.contracts[contractName];
    const [contractAddressImportPath, solidityVarName] = c.addressFullyQualifiedName.split(":");
    assert(contractAddressImportPath);
    assert(solidityVarName);

    const p = this.resolvePath(contractAddressImportPath);
    try {
      const content = fs.readFileSync(p, "utf8");
      const i = content.indexOf(solidityVarName);
      if (i < 0) {
        return undefined;
      }
      let s = content.substring(i + solidityVarName.length).trimStart();
      if (!s.startsWith("=")) {
        return undefined;
      }
      s = s.substring(1).trimStart();
      const j = s.indexOf(";");
      if (j < 0) {
        return undefined;
      }
      s = s.substring(0, j).trimEnd();
      return EthersT.getAddress(s);
    } catch {
      return undefined;
    }
  }

  public computeAddress(contractName: FhevmContractName, deployOptions: FhevmDeployOptions): string {
    if (contractName === "MockedPrecompile" && deployOptions.useExtTfheLib) {
      return EXT_TFHE_LIBRARY;
    }
    const deployer = this.getDeployerWallet(contractName, null);
    const deployerAddress = deployer.address;
    const deployerConfig = this._config.deployer.accounts[this._config.contracts[contractName].deployer];
    assert(this._config.contracts[contractName].nonce < deployerConfig.nextNonce);
    return EthersT.getCreateAddress({
      from: deployerAddress,
      nonce: this._config.contracts[contractName].nonce + deployerConfig.startNonce,
    });
  }

  public adminUserAddresses(): Array<string> {
    const entries = Object.entries(this._config.contracts);
    const indices: Array<number> = [];
    for (let i = 0; i < entries.length; ++i) {
      const [, c]: [string, FhevmContractConfig] = entries[i];
      const deployer = this._config.deployer.accounts[c.deployer].accountIndex;
      if (!indices.includes(deployer)) {
        indices.push(deployer);
      }
      if (c.owner) {
        const owner = this._config.deployer.accounts[c.owner].accountIndex;
        if (!indices.includes(owner)) {
          indices.push(owner);
        }
      }
    }
    return indices.map(
      (i) => walletFromMnemonic(i, this._config.deployer.mnemonic, this._config.deployer.path, null).address,
    );
  }

  public readArtifactSync(contractName: FhevmContractName, artifacts: Artifacts): Artifact {
    const fqn = this._config.contracts[contractName].fullyQualifiedName;
    return artifacts.readArtifactSync(fqn);
  }

  public readArtifact(contractName: FhevmContractName, artifacts: Artifacts): Promise<Artifact> {
    const fqn = this._config.contracts[contractName].fullyQualifiedName;
    return artifacts.readArtifact(fqn);
  }

  public async getFactory(contractName: FhevmContractName, provider: EthersT.Provider, heth: HardhatFhevmEthers) {
    const artifact = await this.readArtifact(contractName, heth.artifacts);
    return heth.ethers.getContractFactoryFromArtifact(artifact, this.getDeployerWallet(contractName, provider));
  }

  public async getContract(contractName: FhevmContractName, provider: EthersT.Provider, heth: HardhatFhevmEthers) {
    const factory = await this.getFactory(contractName, provider, heth);
    const address = this.readAddressFromSolidityFileSync(contractName);
    if (!address) {
      throw new HardhatFhevmError(`Unable to retreive ${contractName} contract artifact`);
    }
    return factory.attach(address);
  }

  public getInfos(contractName: FhevmContractName): {
    solidityAddress: string | undefined;
    dotenvPath: string;
    contractAddressPath: string;
    solidityVarName: string;
    envVarName: string;
  } {
    const solidityAddress = this.readAddressFromSolidityFileSync(contractName);

    const c: FhevmContractConfig = this._config.contracts[contractName];
    assert(c.envVar);
    assert(c.envVar.name);

    const dotenvPath = this.resolvePath(c.envVar.dotenvPath);
    const solInfos = this.getSolidityContractAddressInfos(contractName);

    return {
      solidityAddress,
      dotenvPath,
      contractAddressPath: solInfos.path,
      solidityVarName: solInfos.varName,
      envVarName: c.envVar.name,
    };
  }

  public getBuildInfos(contractName: FhevmContractName, computedAddress: string, artifacts: Artifacts) {
    const infos = this.getInfos(contractName);

    let artifact = null;
    try {
      artifact = this.readArtifactSync(contractName, artifacts);
    } catch {
      artifact = null;
    }

    return {
      solidityAddress: infos.solidityAddress,
      computedAddress,
      artifact,
      build: !infos.solidityAddress || !artifact,
      clean: infos.solidityAddress !== computedAddress && infos.solidityAddress !== undefined,
    };
  }

  public getSolidityContractAddressInfos(contractName: FhevmContractName): { path: string; varName: string } {
    const c: FhevmContractConfig = this._config.contracts[contractName];
    assert(c.envVar);

    const pair = c.addressFullyQualifiedName.split(":");
    assert(pair.length === 2);

    const p = pair.at(0);
    assert(p);

    const varName = pair.at(-1);
    assert(varName);

    return {
      varName,
      path: this.resolvePath(p),
    };
  }

  public writeSolidityAddressSync(contractName: FhevmContractName, computedAddress: string, ifNeeded: boolean) {
    const infos = this.getInfos(contractName);

    if (ifNeeded) {
      const isCurrentlyInstalled = infos.solidityAddress && infos.solidityAddress.length > 0;
      const addressHasChanged = infos.solidityAddress !== computedAddress;

      if (isCurrentlyInstalled && !addressHasChanged) {
        assert(infos.solidityAddress);
        return {
          address: infos.solidityAddress,
          changed: false,
          contractAddressPath: infos.contractAddressPath,
        };
      }
    }

    const dotenvDir = path.dirname(infos.dotenvPath);
    if (!fs.existsSync(dotenvDir)) {
      throw new HardhatFhevmError(`Directory ${dotenvDir} does not exits`);
    }

    const contractAddressDir = path.dirname(infos.contractAddressPath);
    if (!fs.existsSync(contractAddressDir)) {
      throw new HardhatFhevmError(`Directory ${contractAddressDir} does not exits`);
    }

    // Write env file
    const content = `${infos.envVarName}=${computedAddress}\n`;
    try {
      fs.writeFileSync(infos.dotenvPath, content, { flag: "w" });
    } catch (err) {
      throw new HardhatFhevmError(`Failed to write ${contractName} address env file: ${err}`);
    }

    // Write solidity file
    const solidityTemplate = `// SPDX-License-Identifier: BSD-3-Clause-Clear
        pragma solidity ^${this._config.solidityVersion};
      
        address constant ${infos.solidityVarName} = ${computedAddress};\n`;

    try {
      fs.writeFileSync(infos.contractAddressPath, solidityTemplate, { encoding: "utf8", flag: "w" });
    } catch (err) {
      throw new HardhatFhevmError(`Failed to write ACL address solidity file: ${err}`);
    }

    return {
      address: computedAddress,
      changed: computedAddress !== infos.solidityAddress,
      contractAddressPath: infos.contractAddressPath,
    };
  }

  public writeOverridesSolFile() {
    for (let i = 0; i < ZamaDevOverrides.length; ++i) {
      const o = ZamaDevOverrides[i];
      this._writeSolFile(o.path, o.legacy);
    }
  }

  private _writeSolFile(file: string, legacy: boolean) {
    const src = path.join(getHHFhevmPackageSolidityOverridesDir(), file);
    const dst = this.resolvePath(file);

    if (legacy) {
      writeFileWithBackupSync(src, dst, "orig");
    } else {
      fs.copyFileSync(src, dst);
    }
  }

  public restoreOverridedSolFile() {
    for (let i = 0; i < ZamaDevOverrides.length; ++i) {
      const o = ZamaDevOverrides[i];
      this._restoreSolFile(o.path, o.legacy);
    }
  }

  private _restoreSolFile(file: string, legacy: boolean) {
    const p = this.resolvePath(file);

    if (legacy) {
      restoreBackupFileSync(p, "orig", true);
    } else {
      if (fs.existsSync(p)) {
        fs.rmSync(p);
      }
    }
  }

  public copyToSync(dst: string) {
    dst = resolve(dst);
    if (path.basename(dst) === this.libName) {
      dst = path.dirname(dst);
      assert(path.basename(dst) !== this.libName);
    }
    assert(dst != this._repoParentDir);
    const dstFhevm = path.join(dst, this.libName);

    // Delete any existing directory
    if (fsExt.existsSync(dstFhevm)) {
      rimrafSync(dstFhevm);
    }

    // Copy a fresh new set of solidity files
    fsExt.copySync(this.libDir, dstFhevm, {
      overwrite: true,
      filter: (src) => {
        return (
          src.endsWith(".sol") ||
          src.endsWith(".sol.orig") ||
          src.endsWith("fhevm") ||
          src.endsWith("lib") ||
          src.endsWith("gateway")
        );
      },
      dereference: true,
      //recursive: true,
    });
  }

  public listContractsToDeploy(deployOptions: FhevmDeployOptions) {
    return listFhevmContractsInDeployOrder(deployOptions.mock, this._config, undefined /* all */);
  }

  public listContractsFQNToDeploy(deployOptions: FhevmDeployOptions) {
    //const listFQNs: Array<string> = AllReleasedZamaContractNames.map((v) => this.getFullyQualifiedName(v));
    const listFQNs: Array<string> = this.listContractsToDeploy(deployOptions).map((v) => this.getFullyQualifiedName(v));

    // Debug
    assert(listFQNs.at(0) === this.getFullyQualifiedName("ACL"));
    if (deployOptions.mock) {
      // listFQNs.push(this.getFullyQualifiedName("MockedPrecompile"));
      assert(listFQNs.at(3) === this.getFullyQualifiedName("MockedPrecompile"));
    }

    return listFQNs.concat(ZamaDevExtraContractsToCompile);
  }

  public generateImportsSolCode(deployOptions: FhevmDeployOptions) {
    const list = this.listContractsFQNToDeploy(deployOptions);
    const lines = list.map((v) => {
      const a = splitFullyQualifiedName(v);
      return `import {${a.contractName}} from "${a.importPath}";`;
    });
    const firstLines = [
      "// SPDX-License-Identifier: BSD-3-Clause-Clear",
      `pragma solidity ^${this.config.solidityVersion};`,
      "",
      "",
    ];
    return firstLines.join("\n") + lines.join("\n");
  }

  public async areContractsDeployed(deployOptions: FhevmDeployOptions): Promise<boolean> {
    const list = this.listContractsToDeploy(deployOptions);
    // Extra contracts are not tested.
    for (let i = 0; i < list.length; ++i) {
      const contractName = list[i];
      if (!deployOptions.provider) {
        return false;
      }
      const codeAtAddress = await deployOptions.provider.getCode(this.computeAddress(contractName, deployOptions));
      if (codeAtAddress === "0x") {
        return false;
      }
    }
    return true;
  }
}
