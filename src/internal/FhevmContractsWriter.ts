import { Artifacts } from "hardhat/types";
import fs from "fs";
import path from "path";
import { HardhatFhevmError } from "../error";
import { logDim, LogOptions, logTrace } from "./log";
import { FhevmDeployOptions, FhevmContractName } from "./types";
import { replaceAddressesInFileSync } from "./utils/address";
import { FhevmContractsRepository } from "./FhevmContractsRepository";

////////////////////////////////////////////////////////////////////////////////

export class FhevmContractsWriter {
  private _repo: FhevmContractsRepository;
  private _deployOptions: FhevmDeployOptions;
  private _logOptions: LogOptions;

  constructor(repo: FhevmContractsRepository, deployOptions: FhevmDeployOptions, logOptions: LogOptions) {
    this._repo = repo;
    this._deployOptions = { ...deployOptions };
    this._logOptions = { ...logOptions };
    if (!this._deployOptions.mock) {
      this._deployOptions.useExtTfheLib = true;
      this._deployOptions.mockOnChainDecrypt = false;
    }
  }

  public get repository() {
    return this._repo;
  }

  public get deployOptions() {
    return { ...this._deployOptions };
  }

  public async prepareUserSolFiles() {
    const ifNeeded = true;

    if (this._deployOptions.mockOnChainDecrypt) {
      this._repo.writeOverridesSolFile();
    } else {
      this._repo.restoreOverridedSolFile();
    }

    this._patchAllSolidityFilesSync(ifNeeded);
  }

  public prepareImportSolFiles(dotSolPathname: string) {
    const content = this.repository.generateImportsSolCode(this._deployOptions);
    try {
      fs.mkdirSync(path.dirname(dotSolPathname), { recursive: true });
      fs.writeFileSync(dotSolPathname, content, { encoding: "utf8", flag: "w" });
    } catch (err) {
      throw new HardhatFhevmError(`Failed to generate 'imports.sol' file: ${err}`);
    }
  }

  public cleanOrBuildNeeded(artifacts: Artifacts): { clean: boolean; build: boolean } {
    const list = this._repo.listContractsToDeploy(this._deployOptions);
    const res = {
      clean: false,
      build: false,
    };
    for (let i = 0; i < list.length; ++i) {
      const contractName = list[i];
      const buildInfos = this._repo.getBuildInfos(
        contractName,
        this.repository.computeAddress(contractName, this._deployOptions),
        artifacts,
      );
      if (buildInfos.clean) {
        res.clean = true;
        res.build = true;
      }
      if (buildInfos.build) {
        res.build = true;
      }
    }
    return res;
  }

  // public static writeImportMockedPrecompileSync(fhevmPath: string) {
  //   const precompile_dir = getPrecompileDir(fhevmPath);
  //   const dir = _writeImportMockedPrecompileSync(precompile_dir);
  //   return dir;
  // }

  //////////////////////////////////////////////////////////////////////////////

  private _patchAllSolidityFilesSync(ifNeeded: boolean) {
    let changed = false;

    // TODO loop over list of contracts to deploy

    // Write ACL.sol address file
    const ACL_res = this._writeFhevmContractAddressIfNeededSync("ACL", ifNeeded);
    changed = changed || ACL_res.changed;

    // Write TFHEExecutor.sol address file
    const TFHEExecutor_res = this._writeFhevmContractAddressIfNeededSync("TFHEExecutor", ifNeeded);
    changed = changed || TFHEExecutor_res.changed;

    // Write MockedPrecompile.sol address file
    const MockedPrecompile_res = this._writeFhevmContractAddressIfNeededSync("MockedPrecompile", ifNeeded);
    changed = changed || MockedPrecompile_res.changed;

    // // Write TFHEExecutor.sol
    const TFHEExecutor_changed = this._patchTFHEExecutorSync({ ext: MockedPrecompile_res.address });
    changed = changed || TFHEExecutor_changed;

    // Write KMSVerifier.sol address file
    const KMSVerifier_res = this._writeFhevmContractAddressIfNeededSync("KMSVerifier", ifNeeded);
    changed = changed || KMSVerifier_res.changed;

    // Write GatewayContract.sol address file
    const GatewayContract_res = this._writeFhevmContractAddressIfNeededSync("GatewayContract", ifNeeded);
    changed = changed || GatewayContract_res.changed;

    // Write Gateway.sol
    const Gateway_changed = this._patchLibGatewaySync({
      ACL: ACL_res.address,
      GatewayContract: GatewayContract_res.address,
      KMSVerifier: KMSVerifier_res.address,
    });
    changed = changed || Gateway_changed;

    return changed;
  }

  /**
   * returns `true` if "TFHEExecutor.sol" has changed
   */
  private _patchTFHEExecutorSync(contractAddresses: { ext: string }): boolean {
    const TFHEExecutorDotSol = this._repo.getSolidityPath("TFHEExecutor");
    const changed = replaceAddressesInFileSync(TFHEExecutorDotSol, [
      { address: contractAddresses.ext, prefix: "address constant EXT_TFHE_LIBRARY = address(0x", suffix: ");" },
    ]);
    if (changed) {
      logDim("patch TFHEExecutor.sol", this._logOptions);
    }
    return changed;
  }

  /**
   * returns `true` if "Gateway.sol" has changed
   */
  private _patchLibGatewaySync(contractAddresses: {
    ACL: string;
    KMSVerifier: string;
    GatewayContract: string;
  }): boolean {
    const gatewayDotSol = path.join(this._repo.parentDir, "fhevm/gateway/lib/Gateway.sol");

    const changed = replaceAddressesInFileSync(gatewayDotSol, [
      { address: contractAddresses.ACL, prefix: "ACL constant acl = ACL(0x", suffix: "); // Replace by ACL address" },
      {
        address: contractAddresses.KMSVerifier,
        prefix: "KMSVerifier constant kmsVerifier = KMSVerifier(address(0x",
        suffix: "));",
      },
      {
        address: contractAddresses.GatewayContract,
        prefix: "GatewayContract constant gatewayContract = GatewayContract(0x",
        suffix: "); // Replace by GatewayContract address",
      },
    ]);

    if (changed) {
      logTrace(`patch Gateway.sol`, this._logOptions);
    }

    return changed;
  }

  private _writeFhevmContractAddressIfNeededSync(
    contractName: FhevmContractName,
    ifNeeded: boolean,
  ): {
    address: string;
    changed: boolean;
    contractAddressPath: string;
  } {
    return this._repo.writeSolidityAddressSync(
      contractName,
      this.repository.computeAddress(contractName, this._deployOptions),
      ifNeeded,
    );
  }
}

////////////////////////////////////////////////////////////////////////////////
