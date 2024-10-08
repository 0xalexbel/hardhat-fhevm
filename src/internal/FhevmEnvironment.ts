import { ethers as EthersT } from "ethers";
import path from "path";
import fs from "fs";
import assert from "assert";
import { Artifacts, EthereumProvider, HardhatRuntimeEnvironment, NetworkConfig } from "hardhat/types";
import { HardhatFhevmRuntimeEnvironment, HardhatFhevmRuntimeLogOptions, HardhatFhevmType } from "../types";
import { FhevmAPIWrapper } from "./FhevmAPI";
import {
  FhevmUserDeployOptions,
  FhevmDeployOptions,
  ProviderRpcMethods,
  HardhatFhevmEthers,
  FhevmContractsConfig,
} from "./types";
import { HardhatFhevmError } from "../error";
import { HardhatEthersProvider } from "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider";
import { FhevmProviderInfo } from "./FhevmProviderInfo";
import { FhevmProviderType } from "./FhevmProviderType";
import { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";
import {
  DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG,
  DEFAULT_USE_EXT_TFHE_LIB,
  EXT_TFHE_LIBRARY,
  FhevmTypeHHFhevm,
  FhevmTypeMock,
  FhevmTypeNative,
  FhevmTypeRemote,
} from "../constants";
import { logBox, logDim, logDimWithYellowPrefix, logTrace } from "./log";
import { TASK_CLEAN, TASK_COMPILE } from "hardhat/builtin-tasks/task-names";
import { ZamaDev, ZamaDevRemappings } from "./fhevm-config";
import { getLibDirname } from "./utils/dirs";
import rimraf from "rimraf";
import { FhevmContractsRepository } from "./FhevmContractsRepository";
import { FhevmContractsDeployer } from "./FhevmContractsDeployer";
import { FhevmContractsWriter } from "./FhevmContractsWriter";
import { FhevmProvider } from "./FhevmProvider";
import { DockerServices } from "./DockerServices";
import {
  ____deployAndRunGatewayFirstRequestBugAvoider,
  ____writeGatewayFirstRequestBugAvoiderSync,
} from "./TmpGatewayBugPatch";
import { ensurePrefix, ensureSuffix } from "./utils/string_utils";

export class FhevmEnvironment implements HardhatFhevmEthers {
  private _hre: HardhatRuntimeEnvironment;
  private _fhevmAPI: FhevmAPIWrapper;
  private _logOptions: HardhatFhevmRuntimeLogOptions;
  private _userDeployOptions: FhevmUserDeployOptions | undefined;
  private _resolvedDeployOptions: FhevmDeployOptions | undefined;
  private _hreProviderInfos: FhevmProviderInfo | undefined;
  private _paths: FhevmEnvironmentPaths;
  private _skipSolInstallDuringCompilation: boolean | undefined;
  private _config: FhevmContractsConfig;

  // The following properties depend on the current _userDeployOptions
  // must be reset each time the _userDeployOptions is changing
  private udo: {
    providerInfos: FhevmProviderInfo | undefined;
    repository: FhevmContractsRepository | undefined;
    fhevmProvider: FhevmProvider | undefined;
  } = {
    providerInfos: undefined,
    repository: undefined,
    fhevmProvider: undefined,
  };

  /**
   * Constructor must be ultra-lightweight!
   */
  constructor(hre: HardhatRuntimeEnvironment) {
    this._hre = hre;
    this._logOptions = { quiet: false, stderr: true };
    this._fhevmAPI = new FhevmAPIWrapper(this);
    this._paths = new FhevmEnvironmentPaths(this);
    this._config = ZamaDev;
  }

  public get paths() {
    return this._paths;
  }

  public get config() {
    return this._config;
  }

  public get repository() {
    if (!this.udo.repository) {
      this.udo.repository = new FhevmContractsRepository(this.paths.libFhevmSources, this._config);
    }
    return this.udo.repository;
  }

  public get nativeRepository() {
    return new FhevmContractsRepository(this.paths.nativelibFhevmSources, this._config);
  }

  /**
   * HardhatFhevmEthers
   */
  public get artifacts(): Artifacts {
    return this.hre.artifacts;
  }

  /**
   * HardhatFhevmEthers
   */
  public get ethers(): HardhatEthersHelpers {
    return this.hre.ethers;
  }

  public get hre(): HardhatRuntimeEnvironment {
    assert(this._hre);
    return this._hre;
  }

  public async getChainIdOrThrow(): Promise<number> {
    const pi = this._getProviderInfos();
    const chainId = await pi.getChainId();
    return chainId;
  }

  private get noProvider() {
    return this._userDeployOptions?.noProvider === true;
  }

  public get networkName(): string | undefined {
    if (this.noProvider) {
      return undefined;
    }
    if (this._userDeployOptions?.provider) {
      return undefined;
    }
    return this.hre.network.name;
  }

  public get network(): NetworkConfig | undefined {
    const name = this.networkName;
    if (!name) {
      return undefined;
    }
    const cfg = this.hre.config.networks[name];
    return cfg;
  }

  public get networkUrl(): string | undefined {
    const network = this.network;
    if (!network) {
      return undefined;
    }
    if ("url" in network) {
      return network.url;
    }
    return undefined;
  }

  public async getFhevmProviderType() {
    if (this.udo.fhevmProvider !== undefined) {
      return this.udo.fhevmProvider.providerType;
    }
    // Try to resolve the provider type using the current deploy options
    const pi = this._getProviderInfos();
    const pt = await pi.resolveFhevmProviderType();
    return pt;
  }

  public get fhevmProviderOrThrow(): FhevmProvider {
    if (this.udo.fhevmProvider === undefined) {
      throw new HardhatFhevmError(`Undefined FhevmProvider`);
    }
    return this.udo.fhevmProvider;
  }

  public async getFhevmProvider(): Promise<FhevmProvider> {
    if (this.udo.fhevmProvider === undefined) {
      this.udo.fhevmProvider = await this._resolveFhevmProvider();
    }
    return this.udo.fhevmProvider;
  }

  private async _resolveFhevmProvider(): Promise<FhevmProvider> {
    assert(this.udo.fhevmProvider === undefined);

    const pt = await this.getFhevmProviderType();

    if (pt === FhevmProviderType.Unknown) {
      const { UnknownFhevmProvider } = await import("./FhevmProvider");
      return new UnknownFhevmProvider(pt, this);
    }

    if (pt === FhevmProviderType.Zama) {
      const { ZamaFhevmProvider } = await import("./providers/zama/ZamaFhevmProvider");
      return ZamaFhevmProvider.create(pt, this);
    }

    if (pt === FhevmProviderType.Local) {
      const { LocalFhevmProvider } = await import("./providers/local/LocalFhevmProvider");
      return LocalFhevmProvider.create(pt, this, await this._newDockerServices());
    }

    const { MockFhevmProvider } = await import("./providers/mock/MockFhevmProvider");
    return MockFhevmProvider.create(pt, await this.getProviderRpcMethods(), this);
  }

  /**
   * Returns the resolved provider
   */
  public get provider(): EthersT.Provider | HardhatEthersProvider | undefined {
    if (this.noProvider) {
      return undefined;
    }
    if (this._userDeployOptions?.provider !== undefined) {
      return this._userDeployOptions.provider;
    }
    return this.hre.ethers.provider;
  }

  /**
   * Returns the resolved provider, throws an error if undefined
   */
  public get providerOrThrow(): EthersT.Provider | HardhatEthersProvider {
    const p = this.provider;
    if (!p) {
      throw new HardhatFhevmError("Missing provider");
    }
    return p;
  }

  /**
   * Returns the resolved EthereumProvider
   */
  public get ethProvider(): EthereumProvider | undefined {
    if (this.noProvider) {
      return undefined;
    }
    if (this._userDeployOptions?.provider !== undefined) {
      return undefined;
    }
    return this.hre.network.provider;
  }

  /**
   * Returns the resolved EthereumProvider, throws an error if undefined
   */
  public get ethProviderOrThrow(): EthereumProvider {
    const p = this.ethProvider;
    if (!p) {
      throw new HardhatFhevmError("Missing hardhat EthereumProvider");
    }
    return p;
  }

  public async getProviderRpcMethods(): Promise<ProviderRpcMethods> {
    if (this.noProvider) {
      return {
        setBalance: undefined,
        setCode: undefined,
        mine: undefined,
        evmSnapshot: undefined,
        evmRevert: undefined,
      };
    }
    const pi = this._getProviderInfos();
    const rpc = await pi.getRpcMethods();
    return rpc;
  }

  public get isMock() {
    const o = this.deployOptions;
    return o.mock;
  }

  public get isHHFhevm() {
    const o = this.deployOptions;
    return o.mock && o.mockOnChainDecrypt;
  }

  public async isZama() {
    if (this.isMock) {
      return false;
    }
    // The mock flag is not enough to determine if we are running a Local fhevm node
    // Consequently we need to access the fhevm provider type.
    const pt = await this.getFhevmProviderType();
    assert(pt === FhevmProviderType.Unknown || pt === FhevmProviderType.Zama || pt === FhevmProviderType.Local);
    return pt === FhevmProviderType.Zama;
  }

  public async isLocal() {
    if (this.isMock) {
      return false;
    }
    // The mock flag is not enough to determine if we are running a Local fhevm node
    // Consequently we need to access the fhevm provider type.
    const pt = await this.getFhevmProviderType();
    assert(pt === FhevmProviderType.Unknown || pt === FhevmProviderType.Zama || pt === FhevmProviderType.Local);
    return pt === FhevmProviderType.Local;
  }

  public async canDeploy() {
    if (this.isMock) {
      return true;
    }
    // The mock flag is not enough to determine if we are running a Local fhevm node
    // Consequently we need to access the fhevm provider type.
    const pt = await this.getFhevmProviderType();
    return pt === FhevmProviderType.Local;
  }

  public getRemappings() {
    if (!this.isHHFhevm) {
      return {};
    }

    const remappings: Record<string, string> = {};
    const d = this.paths.relHHFhevmSources;
    for (let i = 0; i < ZamaDevRemappings.length; ++i) {
      const rm = path.join(d, ZamaDevRemappings[i]);
      remappings[ZamaDevRemappings[i]] = rm;
    }

    return remappings;
  }

  public getForgeRemappings() {
    if (!this.isHHFhevm) {
      return {};
    }

    const remappings: Record<string, string> = {
      "forge-fhevm/": ensureSuffix(this.paths.relHHFhevmForgeSources, "/"),
    };

    const d = this.paths.relHHFhevmSources;
    for (let i = 0; i < ZamaDevRemappings.length; ++i) {
      const p = ensureSuffix(ZamaDevRemappings[i], "/");
      const rm = path.join(d, p);
      remappings[p] = rm;
    }

    return remappings;
  }

  public get nativeDeployOptions(): FhevmDeployOptions {
    return {
      provider: undefined,
      mock: false,
      mockOnChainDecrypt: false,
      useExtTfheLib: true,
    };
  }

  public async areFhevmContractsDeployed() {
    const repo = this.repository;
    const d = this.deployOptions;
    const deployed = await repo.areContractsDeployed(d);
    return deployed;
  }

  /**
   * Returns the resolved deploy options
   */
  public get deployOptions(): FhevmDeployOptions {
    // if `setUserDeployOptions` has never been called before, then `_resolvedDeployOptions` is still undefined
    // therefore resolve is neeeded.
    if (this._resolvedDeployOptions === undefined) {
      this._resolvedDeployOptions = this._resolveDeployOptions(this._userDeployOptions);
    }
    return this._resolvedDeployOptions;
  }

  public get userDeployOptions(): FhevmUserDeployOptions | undefined {
    if (this._userDeployOptions === undefined) {
      return undefined;
    }
    return { ...this._userDeployOptions };
  }

  private async _newDockerServices(): Promise<DockerServices> {
    const nativeDeployOptions = this.nativeDeployOptions;
    const repository = this.nativeRepository;
    const TFHEExecutorAddress = repository.computeAddress("TFHEExecutor", nativeDeployOptions);
    const GatewayContractAddress = repository.computeAddress("GatewayContract", nativeDeployOptions);

    const dockerServices = new DockerServices(this.paths.localFhevmNodeCache, this.logOptions);
    await dockerServices.initWith(TFHEExecutorAddress, GatewayContractAddress, this.hre.config.fhevmNode);
    return dockerServices;
  }

  public async setLocalUserDeployOptions(dockerServices?: DockerServices): Promise<FhevmUserDeployOptions | undefined> {
    if (!dockerServices) {
      dockerServices = await this._newDockerServices();
    }
    assert(dockerServices.initialized);
    const old = this._setUserDeployOptions({ ...this.nativeDeployOptions, provider: dockerServices.jsonRpcProvider() });
    const { LocalFhevmProvider } = await import("./providers/local/LocalFhevmProvider");

    this.udo.fhevmProvider = await LocalFhevmProvider.create(FhevmProviderType.Local, this, dockerServices);
    return old;
  }

  public setUserDeployOptionsNoProvider(
    fhevmType: HardhatFhevmType | undefined,
    useExtTfheLib: boolean | undefined,
  ): FhevmUserDeployOptions | undefined {
    assert(this._hre);
    const userDeployOptionsNoProvider = this._resolveUserDeployOptionsNoProvider(fhevmType, useExtTfheLib);
    return this._setUserDeployOptions(userDeployOptionsNoProvider);
  }

  public setUserDeployOptions(options: FhevmUserDeployOptions | undefined): FhevmUserDeployOptions | undefined {
    return this._setUserDeployOptions(options);
  }

  private _setUserDeployOptions(options: FhevmUserDeployOptions | undefined): FhevmUserDeployOptions | undefined {
    this.checkUserDeployOptions(options);

    const o = this._userDeployOptions;
    if (options === undefined) {
      this._userDeployOptions = undefined;
    } else {
      this._userDeployOptions = { ...options };
    }

    // Reset all the properties depending on _userDeployOptions
    this.udo.providerInfos = undefined;
    this.udo.repository = undefined;
    this.udo.fhevmProvider = undefined;

    return o;
  }

  private _getProviderInfos(): FhevmProviderInfo {
    assert(this._hre);
    //assert(!this.noProvider);

    if (
      this._userDeployOptions !== undefined &&
      (this._userDeployOptions.provider || this._userDeployOptions.noProvider === true)
    ) {
      if (!this.udo.providerInfos) {
        this.udo.providerInfos = new FhevmProviderInfo(this._userDeployOptions.provider, undefined, this);
      }
      return this.udo.providerInfos;
    } else {
      if (this._hreProviderInfos === undefined) {
        this._hreProviderInfos = new FhevmProviderInfo(this._hre.ethers.provider, this._hre.network.provider, this);
      }
      return this._hreProviderInfos;
    }
  }

  /**
   *  API
   */
  get externalFhevmAPI(): HardhatFhevmRuntimeEnvironment {
    return this._fhevmAPI;
  }

  /**
   *  API
   */
  get logOptions(): HardhatFhevmRuntimeLogOptions {
    return { ...this._logOptions };
  }

  /**
   *  API
   */
  set logOptions(value: HardhatFhevmRuntimeLogOptions) {
    this._logOptions = { ...value };
  }

  /**
   * When a provider is specified, all other properties must be set, otherwise
   * we are not able to determine the exact deploy options.
   * If ignoreProvider === true, all properties except `provider` must be set as well.
   */
  private checkUserDeployOptions(options: FhevmUserDeployOptions | undefined) {
    if (options?.noProvider === true || options?.provider !== undefined) {
      if (options.mock === undefined) {
        throw new HardhatFhevmError(
          `Missing 'mock' property, undefined is not permitted when running with a specified provider.`,
        );
      }
      if (options.mockOnChainDecrypt === undefined) {
        if (options.mock === true) {
          throw new HardhatFhevmError(
            `Missing 'mockOnChainDecrypt' property, undefined is not permitted when running with a specified provider.`,
          );
        }
      }
      if (options.useExtTfheLib === undefined) {
        if (options.mock === true) {
          throw new HardhatFhevmError(
            `Missing 'useExtTfheLib' property, undefined is not permitted when running with a specified provider.`,
          );
        }
      }
    }
  }

  /**
   * Depends on:
   * - options argument
   * - hre.network.config.fhevm
   * - hre.ethers.provider
   */
  private _resolveDeployOptions(options: FhevmUserDeployOptions | undefined): FhevmDeployOptions {
    /*
      Called by:

      setUserDeployOptionsNoProvider
      |__resolveUserDeployOptionsNoProvider

      or

      get deployOptions() property
    */
    this.checkUserDeployOptions(options);

    if (!options) {
      if (this.hre.network.config.fhevm === FhevmTypeRemote) {
        throw new HardhatFhevmError(`fhevm = "${FhevmTypeRemote}" not yet supported`);
      }
      const mock = this.hre.network.config.fhevm !== FhevmTypeNative;
      return {
        provider: this.hre.ethers.provider,
        mock,
        mockOnChainDecrypt: this.hre.network.config.fhevm === FhevmTypeHHFhevm,
        useExtTfheLib: mock ? DEFAULT_USE_EXT_TFHE_LIB : true, // by default, always deploy mocked precompile
      };
    }

    if (options.provider !== undefined || options.noProvider === true) {
      // checked in checkUserDeployOptions
      assert(options.mock !== undefined);
      assert(options.mockOnChainDecrypt !== undefined);
      assert(options.useExtTfheLib !== undefined);

      return {
        provider: options.noProvider === true ? undefined : options.provider,
        mock: options.mock,
        mockOnChainDecrypt: options.mockOnChainDecrypt,
        useExtTfheLib: options.useExtTfheLib,
      };
    }

    let mock = options.mock;
    if (mock === undefined) {
      if (this.hre.network.config.fhevm === FhevmTypeRemote) {
        throw new HardhatFhevmError(`fhevm = "${FhevmTypeRemote}" not yet supported`);
      }
      mock = this.hre.network.config.fhevm !== FhevmTypeNative;
    } else {
      if (this.hre.network.config.fhevm === FhevmTypeNative) {
        if (mock === true) {
          throw new HardhatFhevmError(
            `Cannot setup a mock fhevm on network '${this.hre.network.name}' since it is configured as a '${FhevmTypeNative}' fhevm network.`,
          );
        }
      } else {
        if (mock === false) {
          throw new HardhatFhevmError(
            `Cannot setup a native fhevm on network '${this.hre.network.name}' since it is configured as a '${FhevmTypeMock}' fhevm network.`,
          );
        }
      }
    }

    let mockOnChainDecrypt = options.mockOnChainDecrypt;
    if (!mock) {
      mockOnChainDecrypt = false;
    } else if (mockOnChainDecrypt === undefined) {
      if (this.hre.network.config.fhevm === FhevmTypeRemote) {
        throw new HardhatFhevmError(`fhevm = "${FhevmTypeRemote}" not yet supported`);
      }
      mockOnChainDecrypt = this.hre.network.config.fhevm === FhevmTypeHHFhevm;
    }

    let useExtTfheLib = options.useExtTfheLib;
    if (!mock) {
      useExtTfheLib = true;
    } else if (useExtTfheLib === undefined) {
      if (this.hre.network.config.fhevm === FhevmTypeRemote) {
        throw new HardhatFhevmError(`fhevm = "${FhevmTypeRemote}" not yet supported`);
      }
      useExtTfheLib = DEFAULT_USE_EXT_TFHE_LIB;
    }

    return {
      provider: this.hre.ethers.provider,
      mock,
      mockOnChainDecrypt,
      useExtTfheLib,
    };
  }

  // only called by:
  //  setUserDeployOptionsNoProvider
  //    |__resolveUserDeployOptionsNoProvider
  private _resolveDeployOptionsWith(
    fhevmType: HardhatFhevmType | undefined,
    useExtTfheLib: boolean | undefined,
  ): FhevmDeployOptions {
    if (fhevmType === undefined) {
      // use the resolved options
      const o = this._resolveDeployOptions(this._userDeployOptions);
      if (useExtTfheLib !== undefined) {
        o.useExtTfheLib = useExtTfheLib;
      }
      return o;
    }

    switch (fhevmType) {
      case FhevmTypeNative:
        return {
          provider: undefined,
          mock: false,
          useExtTfheLib: true,
          mockOnChainDecrypt: false,
        };

      case FhevmTypeMock:
        return {
          provider: undefined,
          mock: true,
          useExtTfheLib: useExtTfheLib === undefined ? DEFAULT_USE_EXT_TFHE_LIB : useExtTfheLib,
          mockOnChainDecrypt: false,
        };

      case FhevmTypeHHFhevm:
        return {
          provider: undefined,
          mock: true,
          useExtTfheLib: useExtTfheLib === undefined ? DEFAULT_USE_EXT_TFHE_LIB : useExtTfheLib,
          mockOnChainDecrypt: true,
        };

      default:
        throw new HardhatFhevmError(`Unknown fhevm type '${fhevmType}'`);
    }
  }

  // only called by setUserDeployOptionsNoProvider
  private _resolveUserDeployOptionsNoProvider(
    fhevmType: HardhatFhevmType | undefined,
    useExtTfheLib: boolean | undefined,
  ): FhevmUserDeployOptions {
    // We use the a resolved deploy options to build a new user deploy options out of it.
    const o: FhevmDeployOptions = this._resolveDeployOptionsWith(fhevmType, useExtTfheLib);
    return {
      ...o,
      provider: undefined,
      noProvider: true,
    };
  }

  public logTrace(msg: string) {
    logTrace(msg, this._logOptions);
  }
  public logDim(msg: string) {
    logDim(msg, this._logOptions);
  }
  public logBox(msg: string) {
    logBox(msg, this._logOptions);
  }
  public logDeployOptions(deployOptions: FhevmDeployOptions) {
    if (deployOptions.mock) {
      logDimWithYellowPrefix("fhevm type         : ", "mock", this._logOptions);
    } else {
      logDimWithYellowPrefix("fhevm type         : ", "native", this._logOptions);
    }
    if (deployOptions.mockOnChainDecrypt) {
      logDimWithYellowPrefix("fhevm decryption   : ", "on-chain", this._logOptions);
    } else {
      logDimWithYellowPrefix("fhevm decryption   : ", "off-chain", this._logOptions);
    }
    if (deployOptions.useExtTfheLib) {
      logDimWithYellowPrefix("fhevm TFHE address : ", EXT_TFHE_LIBRARY, this._logOptions);
    } else {
      logDimWithYellowPrefix("fhevm TFHE address : ", "deployed", this._logOptions);
    }
  }

  public async runClean() {
    const res = await this.hre.run(TASK_CLEAN);
    return res;
  }

  public get skipSolInstallDuringCompilation() {
    return this._skipSolInstallDuringCompilation === true;
  }

  private _newWriter(repository?: FhevmContractsRepository) {
    const repo = repository ?? this.repository;
    return new FhevmContractsWriter(repo, this.deployOptions, this.logOptions);
  }

  public async cleanOrBuildNeeded(repository?: FhevmContractsRepository) {
    const writer = this._newWriter(repository);
    return writer.cleanOrBuildNeeded(this.artifacts);
  }

  private _installLibFhevmSourcesIfNeeded() {
    const repo = this.repository;
    if (fs.existsSync(repo.libDir)) {
      return;
    }
    // Legacy repo dir
    const libFhevmNodeModuleDir = this.paths.libFhevmNodeModule;
    if (!fs.existsSync(libFhevmNodeModuleDir)) {
      throw new HardhatFhevmError(
        `the 'fhevm' dependency module is not installed. Add the 'fhevm' module to your dependencies in the package.json file`,
      );
    }
    const libFhevmNodeModuleRepo = new FhevmContractsRepository(path.dirname(libFhevmNodeModuleDir), this._config);
    libFhevmNodeModuleRepo.copyToSync(this.repository.parentDir);
  }

  public async installSolidityFiles(repository?: FhevmContractsRepository) {
    const writer = this._newWriter(repository);

    this.logDeployOptions(writer.deployOptions);

    // 1- Create a new fhevm lib directory if needed
    // check if this.paths.hhFhevmSources exits of copy!
    this._installLibFhevmSourcesIfNeeded();
    //npx hardhat --network localhost fhevm setup

    // 2- Patch solidity files with fhevm contract addresses
    await writer.prepareUserSolFiles();

    // 3- Generate a dev-freindly imports.sol temporary file
    //    so that all the required artifacts will be generated.
    writer.prepareImportSolFiles(this.paths.cacheImportsSol);

    // 4- In local-fhevm mode, add an extra temp contract
    //    to patch a specific server-side bug.
    const pt = await this.getFhevmProviderType();
    if (pt === FhevmProviderType.Local) {
      ____writeGatewayFirstRequestBugAvoiderSync(
        path.join(this.paths.cacheImports, `GatewayFirstRequestBugAvoider.sol`),
        this._config.solidityVersion,
      );
    }
  }

  public async runCompile(compileOptions?: { skipSolInstall?: boolean; sourcesDir?: string }) {
    if (this._skipSolInstallDuringCompilation !== undefined) {
      throw new HardhatFhevmError(`compilation reentrancy error.`);
    } else {
      this._skipSolInstallDuringCompilation = compileOptions?.skipSolInstall === true;
    }

    const saved_sourcesDir = this.hre.config.paths.sources;
    this.hre.config.paths.sources =
      compileOptions?.sourcesDir === undefined ? saved_sourcesDir : compileOptions.sourcesDir;

    try {
      this.logTrace("compile solidity");
      const res = await this.hre.run(TASK_COMPILE, { quiet: !true });
      return res;
    } finally {
      this.hre.config.paths.sources = saved_sourcesDir;
      this._skipSolInstallDuringCompilation = undefined;
    }
  }

  public async clearCache() {
    await rimraf(this.paths.cache);
  }

  public get gatewayRelayerWalletAddress() {
    const pk = ensurePrefix(this._hre.config.fhevmNode.gatewayRelayerPrivateKey, "0x");
    return EthersT.computeAddress(pk);
  }

  public get gatewayRelayerWallet(): EthersT.Wallet {
    const pk = ensurePrefix(this._hre.config.fhevmNode.gatewayRelayerPrivateKey, "0x");
    return new EthersT.Wallet(pk);
  }

  public async deploy() {
    if (!(await this.canDeploy())) {
      return;
    }

    const deployer: FhevmContractsDeployer = await FhevmContractsDeployer.create(this);
    const res = await deployer.deploy(this.gatewayRelayerWalletAddress);

    if (await this.isLocal()) {
      logTrace("deploy gateway bug fix", this._logOptions);
      const provider = this.provider;
      assert(provider);
      await ____deployAndRunGatewayFirstRequestBugAvoider(this._config, provider, this);
    }

    return res;
  }

  public async runSetup() {
    // Setup admin balances
    const adminAddresses = this.getAdminAddresses();
    // set admin balance to a unified amount (may not be ok, depending on the node type ?)
    await this.setBalances(adminAddresses, DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.accountsBalance);

    // Install + Compile
    await this.runCompile();

    // Deploy contracts
    await this.deploy();
  }

  public getAdminAddresses() {
    const addresses = this.repository.adminUserAddresses();

    // Add the Gateway Relayer.
    // The Gateway Relayer needs balance to relay decryptions.
    addresses.push(this.gatewayRelayerWalletAddress);

    return addresses;
  }

  public async setBalances(addresses: string[], amount: string) {
    if (addresses.length === 0) {
      return;
    }
    const fhevmProvider = await this.getFhevmProvider();
    if (await fhevmProvider.canSetBalance()) {
      this.logTrace(`setup accounts balance (count=${addresses.length})`);
      await fhevmProvider.batchSetBalance(addresses, amount);
    } else {
      this.logTrace("cannot setup accounts balance");
    }
  }

  public async getSoliditySourcePaths() {
    const filePaths = [this.paths.cacheImportsSol];
    if (await this.isLocal()) {
      filePaths.push(path.join(this.paths.cacheImports, `GatewayFirstRequestBugAvoider.sol`));
    }
    return filePaths;
  }
}

////////////////////////////////////////////////////////////////////////////////

class FhevmEnvironmentPaths {
  private _fhevmEnv: FhevmEnvironment;
  constructor(fhevmEnv: FhevmEnvironment) {
    this._fhevmEnv = fhevmEnv;
  }

  /**
   * Returns `/path/to/user-package/hh-fhevm/cache`
   */
  public get cache(): string {
    return this._fhevmEnv.hre.config.paths.hhFhevmCache;
  }

  /**
   * Returns `/path/to/user-package/hh-fhevm/cache/contracts/imports`
   */
  public get cacheImports(): string {
    return path.join(this.cache, "contracts/imports");
  }

  /**
   * Returns `/path/to/user-package/hh-fhevm/cache/contracts/imports/imports.sol`
   */
  public get cacheImportsSol(): string {
    return path.join(this.cacheImports, "imports.sol");
  }

  /**
   * Returns `/path/to/user-package/node_modules`
   */
  public get nodeModules(): string {
    return path.join(this._fhevmEnv.hre.config.paths.root, "node_modules");
  }

  /**
   * Returns `/path/to/user-package/node_modules/fhevm`
   *
   * with basename = `fhevm`
   */
  public get libFhevmNodeModule(): string {
    return path.join(this.nodeModules, this._fhevmEnv.config.libName);
  }

  /**
   * Returns `/path/to/lib/fhevm`
   *
   * with basename = `fhevm`
   */
  public get libFhevmSources(): string {
    const d = this._fhevmEnv.deployOptions;
    let pathToLib;
    if (d.mock && d.mockOnChainDecrypt) {
      // in "hh-fhevm" mode
      pathToLib = this._fhevmEnv.hre.config.paths.hhFhevmSources;
    } else {
      // in "native"|"mock" mode
      pathToLib = this.libFhevmNodeModule;
    }
    return path.join(getLibDirname(pathToLib, this._fhevmEnv.config, false), this._fhevmEnv.config.libName);
  }

  /**
   * Native uses the standard fhevm sources located in the node_modules directory.
   *
   * Returns `/path/to/user-package/node_modules/fhevm`
   *
   * with basename = `fhevm`
   */
  public get nativelibFhevmSources(): string {
    return path.join(
      getLibDirname(this.libFhevmNodeModule, this._fhevmEnv.config, false),
      this._fhevmEnv.config.libName,
    );
  }

  /**
   * Returns `/path/to/hh-fhevm/contracts/fhevm`
   *
   * with basename = `fhevm`
   */
  public get libHHFhevmSources(): string {
    const pathToLib = this._fhevmEnv.hre.config.paths.hhFhevmSources;
    return path.join(getLibDirname(pathToLib, this._fhevmEnv.config, false), this._fhevmEnv.config.libName);
  }

  /**
   * Returns `hh-fhevm/contracts`
   */
  public get relHHFhevmSources(): string {
    const abs = getLibDirname(this._fhevmEnv.hre.config.paths.hhFhevmSources, this._fhevmEnv.config, false);
    return path.relative(this._fhevmEnv.hre.config.paths.root, abs);
  }

  /**
   * Returns `hh-fhevm/contracts/forge-fhevm`
   */
  public get relHHFhevmForgeSources(): string {
    const abs = path.join(
      getLibDirname(this._fhevmEnv.hre.config.paths.hhFhevmSources, this._fhevmEnv.config, false),
      "forge-fhevm",
    );
    return path.relative(this._fhevmEnv.hre.config.paths.root, abs);
  }

  /**
   * Returns `/path/to/hh-fhevm/contracts/forge-fhevm`
   */
  public get HHFhevmForgeSources(): string {
    const abs = path.join(
      getLibDirname(this._fhevmEnv.hre.config.paths.hhFhevmSources, this._fhevmEnv.config, false),
      "forge-fhevm",
    );
    return abs;
  }

  /**
   * Returns `hh-fhevm/local-fhevm-node`
   */
  public get localFhevmNodeCache(): string {
    return this._fhevmEnv.hre.config.paths.localFhevmNodeCache;
  }
}
