import assert from "assert";
import { extendConfig, extendEnvironment, extendProvider, scope, subtask, task, types } from "hardhat/config";
import {
  EIP1193Provider,
  HardhatConfig,
  HardhatNetworkAccountsConfig,
  HardhatRuntimeEnvironment,
  HardhatUserConfig,
  HttpNetworkAccountsConfig,
  TaskArguments,
} from "hardhat/types";
import { HARDHAT_NETWORK_NAME, lazyObject } from "hardhat/plugins";
import path from "path";
import { FhevmCompileOptions, FhevmNodeConfig, HardhatFhevmRuntimeLogOptions } from "./types";
import {
  DEFAULT_GATEWAY_RELAYER_PRIVATE_KEY,
  DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG,
  DEFAULT_LOCAL_FHEVM_HTTP_PORT,
  DEFAULT_LOCAL_FHEVM_WS_PORT,
  EXT_TFHE_LIBRARY,
  LOCAL_FHEVM_NETWORK_NAME,
  ZAMA_DEV_NETWORK_CONFIG,
  ZAMA_DEV_NETWORK_NAME,
  ZamaDev,
  ZamaDevConfig,
} from "./constants";
import {
  TASK_FHEVM_CLEAN_IF_NEEDED,
  TASK_FHEVM_COMPILE,
  TASK_FHEVM_COMPILE_DIR,
  TASK_FHEVM_DEPLOY,
  TASK_FHEVM_DEPLOY_EXTRA,
  TASK_FHEVM_DEPLOY_MOCK_PRECOMPILE,
  TASK_FHEVM_DOCKER_CONFIG,
  TASK_FHEVM_DOCKER_DOWN,
  TASK_FHEVM_DOCKER_UP,
  TASK_FHEVM_INTERNAL_INSTALL_SOLIDITY,
  TASK_FHEVM_START_LOCAL,
  TASK_FHEVM_START_MOCK,
  TASK_FHEVM_STOP_LOCAL,
} from "./internal-task-names";
import { TASK_COMPILE, TASK_CLEAN, TASK_TEST } from "hardhat/builtin-tasks/task-names";
import { HardhatFhevmError } from "./error";
import { logBox, logDim, logTrace } from "./log";
import {
  ____deployAndRunGatewayFirstRequestBugAvoider,
  ____writeGatewayFirstRequestBugAvoider,
  getUserPackageNodeModulesDir,
  zamaAreContractsDeployed,
  zamaCleanOrBuildNeeded,
  zamaDeploy,
  zamaPrepareCompilationIfNeeded,
  zamaAdminUserAddresses,
  zamaWriteMockPrecompileSync,
} from "./common/zamaContracts";
import { ethers as EthersT } from "ethers";
import { getDeployedByteCode } from "./utils";
import { HardhatFhevmRuntimeEnvironment } from "./common/HardhatFhevmRuntimeEnvironment";
import { keysInstallNeeded } from "./dirs";
import { FhevmProvider } from "./provider";
import {
  SCOPE_FHEVM,
  SCOPE_FHEVM_TASK_CLEAN,
  SCOPE_FHEVM_TASK_RESTART,
  SCOPE_FHEVM_TASK_START,
  SCOPE_FHEVM_TASK_STOP,
  TASK_FHEVM_SETUP,
  TASK_FHEVM_INSTALL_SOLIDITY,
} from "./task-names";
import rimraf from "rimraf";
import { DockerServices, LOCAL_FHEVM_CHAIN_ID } from "./common/DockerServices";
import { walletFromMnemonic } from "./wallet";

import "./type-extensions";
import { HardhatFhevmProviderType, providerTypeToString } from "./common/HardhatFhevmProviderType";

////////////////////////////////////////////////////////////////////////////////

function _getAdminAddresses(config: ZamaDevConfig, hre: HardhatRuntimeEnvironment) {
  const addresses = zamaAdminUserAddresses(config);

  // Add the Gateway Relayer.
  // The Gateway Relayer needs balance to relay decryptions.
  addresses.push(hre.fhevm.gatewayRelayerWallet().address);

  return addresses;
}

////////////////////////////////////////////////////////////////////////////////

function _getUserAddresses(config: ZamaDevConfig, accounts: HardhatNetworkAccountsConfig | HttpNetworkAccountsConfig) {
  if (typeof accounts === "string") {
    return [];
  }

  if (Array.isArray(accounts)) {
    if (accounts.length === 0) {
      return [];
    }
    // accounts: string[]
    if (typeof accounts[0] === "string") {
      const _accounts = accounts as Array<string>;
      return _accounts.map((v) => new EthersT.Wallet(v).address);
    }
    // accounts: HardhatNetworkAccountConfig[]
    return [];
  }

  const http_accounts: HttpNetworkAccountsConfig = accounts;
  const addresses = [];
  for (let i = 0; i < http_accounts.count; ++i) {
    const a = walletFromMnemonic(
      i + http_accounts.initialIndex,
      http_accounts.mnemonic,
      http_accounts.path,
      null,
    ).address;
    addresses.push(a);
  }
  return addresses;
}

////////////////////////////////////////////////////////////////////////////////

async function _getFhevmCompileOptions(hre: HardhatRuntimeEnvironment): Promise<FhevmCompileOptions> {
  const onChainFhevmMockProcessor = await hre.fhevm.useMockOnChainDecryption();
  return {
    onChainFhevmMockProcessor,
  };
}

////////////////////////////////////////////////////////////////////////////////
// Exports
////////////////////////////////////////////////////////////////////////////////

export { ZAMA_DEV_NETWORK_CONFIG } from "./constants";
export { LOCAL_FHEVM_CHAIN_ID } from "./common/DockerServices";
export * from "./types";
export { HardhatFhevmInstance } from "./common/HardhatFhevmInstance";
export { HardhatFhevmRuntimeEnvironment } from "./common/HardhatFhevmRuntimeEnvironment";
export { HardhatFhevmProviderType } from "./common/HardhatFhevmProviderType";

////////////////////////////////////////////////////////////////////////////////
// HH Plugin Config
////////////////////////////////////////////////////////////////////////////////

extendConfig((config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
  const userFhevmPath = userConfig.paths?.fhevm;
  const userFhevmNode = userConfig.fhevmNode;

  const fhevmNode: FhevmNodeConfig = {
    accounts: {
      count: userFhevmNode?.accounts?.count ?? DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.count,
      accountsBalance: userFhevmNode?.accounts?.accountsBalance ?? DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.accountsBalance,
      initialIndex: userFhevmNode?.accounts?.initialIndex ?? DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.initialIndex,
      passphrase: userFhevmNode?.accounts?.passphrase ?? DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.passphrase,
      path: userFhevmNode?.accounts?.path ?? DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.path,
      mnemonic: userFhevmNode?.accounts?.mnemonic ?? DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.mnemonic,
    },
    gatewayRelayerPrivateKey: userFhevmNode?.gatewayRelayerPrivateKey ?? DEFAULT_GATEWAY_RELAYER_PRIVATE_KEY,
    httpPort: userFhevmNode?.httpPort ?? DEFAULT_LOCAL_FHEVM_HTTP_PORT,
    wsPort: userFhevmNode?.wsPort ?? DEFAULT_LOCAL_FHEVM_WS_PORT,
  };
  config.fhevmNode = fhevmNode;

  const defaultMockFhevm = true;
  const defaultUseOnChainFhevmMockProcessor: boolean | undefined = undefined;

  // Initialize to mockFhevm = true + useOnChainFhevmMockProcessor = false
  const networks = Object.keys(config.networks);
  for (let i = 0; i < networks.length; ++i) {
    const networkName = networks[i];
    const network = config.networks[networkName];
    network.mockFhevm = defaultMockFhevm;
    network.useOnChainFhevmMockProcessor = defaultUseOnChainFhevmMockProcessor;
  }

  // Exception for "localhost"
  config.networks["localhost"].mockFhevm = true;
  config.networks["localhost"].useOnChainFhevmMockProcessor = true;

  // if "zamadev" network is not there, add the default config
  if (!userConfig.networks || !(ZAMA_DEV_NETWORK_NAME in userConfig.networks)) {
    config.networks[ZAMA_DEV_NETWORK_NAME] = ZAMA_DEV_NETWORK_CONFIG;
  }

  // if "fhevm" network is not there, add the default config
  if (!userConfig.networks || !(LOCAL_FHEVM_NETWORK_NAME in userConfig.networks)) {
    config.networks[LOCAL_FHEVM_NETWORK_NAME] = {
      url: `http://localhost:${fhevmNode.httpPort}`,
      accounts: DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG,
      chainId: LOCAL_FHEVM_CHAIN_ID,
      mockFhevm: false,
      useOnChainFhevmMockProcessor: false,
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1,
      timeout: 40000,
      httpHeaders: {},
    };
  }

  config.networks[HARDHAT_NETWORK_NAME].mockFhevm = true;
  config.networks[HARDHAT_NETWORK_NAME].useOnChainFhevmMockProcessor = false;

  // Overrides
  if (userConfig.networks) {
    const userNetworks = userConfig.networks;
    const userNetworkNames = Object.keys(userNetworks);
    for (let i = 0; i < userNetworkNames.length; ++i) {
      const userNetworkName = userNetworkNames[i];
      const userNetwork = userNetworks[userNetworkName];
      if (userNetwork?.mockFhevm !== undefined) {
        config.networks[userNetworkName].mockFhevm = userNetwork.mockFhevm;
      }
      if (userNetwork?.useOnChainFhevmMockProcessor !== undefined) {
        config.networks[userNetworkName].useOnChainFhevmMockProcessor = userNetwork.useOnChainFhevmMockProcessor;
      }
      if (!config.networks[userNetworkName].mockFhevm) {
        config.networks[userNetworkName].useOnChainFhevmMockProcessor = false;
      }
    }
  }

  // Zama Dev is never in mock mode
  for (let i = 0; i < networks.length; ++i) {
    const networkName = networks[i];
    const network = config.networks[networkName];
    if ("url" in network && network.url === ZAMA_DEV_NETWORK_CONFIG.url) {
      network.mockFhevm = false;
      network.useOnChainFhevmMockProcessor = false;
    }
  }

  let fhevmPath: string;

  if (userFhevmPath === undefined) {
    fhevmPath = path.join(config.paths.root, "hh_fhevm");
  } else {
    if (path.isAbsolute(userFhevmPath)) {
      fhevmPath = userFhevmPath;
    } else {
      fhevmPath = path.normalize(path.join(config.paths.root, userFhevmPath));
    }
  }

  const contractsAbsolutePath = path.join(config.paths.root, "node_modules");

  config.paths.fhevm = fhevmPath;
  config.paths.fhevmContracts = contractsAbsolutePath;
});

////////////////////////////////////////////////////////////////////////////////
// HH Plugin Environment
////////////////////////////////////////////////////////////////////////////////

extendEnvironment((hre) => {
  hre.fhevm = lazyObject(() => {
    return new HardhatFhevmRuntimeEnvironment(hre);
  });
});

////////////////////////////////////////////////////////////////////////////////
// HH Plugin Provider
////////////////////////////////////////////////////////////////////////////////

extendProvider(async (provider: EIP1193Provider, config: HardhatConfig, network: string) => {
  return new FhevmProvider(provider, config, network);
});

////////////////////////////////////////////////////////////////////////////////
// Docker tasks
////////////////////////////////////////////////////////////////////////////////

/* eslint-disable no-empty-pattern */
subtask(TASK_FHEVM_DOCKER_CONFIG).setAction(async ({}, hre: HardhatRuntimeEnvironment) => {
  // No network constraint
  return DockerServices.computeDockerServicesConfig(ZamaDev, hre.config.fhevmNode);
});

subtask(TASK_FHEVM_DOCKER_UP)
  .addParam("dockerServices", undefined, undefined, types.any)
  .setAction(async ({ dockerServices }: { dockerServices: DockerServices }, hre: HardhatRuntimeEnvironment) => {
    // No network constraint
    await dockerServices.initWith(ZamaDev, hre.config.fhevmNode);
    await dockerServices.up();
  });

subtask(TASK_FHEVM_DOCKER_DOWN)
  .addParam("dockerServices", undefined, undefined, types.any)
  .setAction(async ({ dockerServices }: { dockerServices: DockerServices }, hre: HardhatRuntimeEnvironment) => {
    // No network constraint
    await dockerServices.initWith(ZamaDev, hre.config.fhevmNode);
    await dockerServices.down();
  });

////////////////////////////////////////////////////////////////////////////////
// Compile tasks
////////////////////////////////////////////////////////////////////////////////

subtask(TASK_FHEVM_COMPILE_DIR)
  .addParam("dir", undefined, undefined, types.string)
  .addParam("compileOptions", undefined, undefined, types.any)
  .setAction(
    async (
      { dir, compileOptions }: { dir: string; compileOptions: FhevmCompileOptions },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const sources = hre.config.paths.sources;
      hre.config.paths.sources = dir;
      try {
        await hre.run(TASK_COMPILE, { quiet: true, fhevmCompileOptions: compileOptions });
      } finally {
        hre.config.paths.sources = sources;
      }
    },
  );

subtask(TASK_FHEVM_CLEAN_IF_NEEDED).setAction(async ({}, hre) => {
  const contractsRootDir = getUserPackageNodeModulesDir(hre.config);
  const cleanOrBuild = zamaCleanOrBuildNeeded(contractsRootDir, ZamaDev, hre);
  if (cleanOrBuild.clean) {
    logTrace("rebuild needed!", hre.fhevm.logOptions);
    await hre.run(TASK_CLEAN);
  }
  return cleanOrBuild;
});

/**
 * Generates FHEVM contacts in node_modules/fhevm
 * Generates a temporary 'import' solidity file in 'hh_fhevm' directory
 * Compiles the import solidity file
 */
subtask(TASK_FHEVM_COMPILE)
  .addParam("compileOptions", undefined, undefined, types.any)
  .setAction(async ({ compileOptions }: { compileOptions: FhevmCompileOptions }, hre) => {
    logTrace("compile fhevm contracts", hre.fhevm.logOptions);

    if (compileOptions.onChainFhevmMockProcessor) {
      logDim(`use on chain fast mock executor`, hre.fhevm.logOptions);
    } else {
      logDim(`use standard mock executor`, hre.fhevm.logOptions);
    }

    const contractsRootDir = getUserPackageNodeModulesDir(hre.config);
    const dir_to_compile = await zamaPrepareCompilationIfNeeded(
      compileOptions,
      contractsRootDir,
      hre.config.paths,
      ZamaDev,
      hre.fhevm.logOptions,
    );
    if (dir_to_compile) {
      await hre.run(TASK_FHEVM_COMPILE_DIR, { dir: dir_to_compile, compileOptions });
    }
  });

////////////////////////////////////////////////////////////////////////////////
// Deploy tasks
////////////////////////////////////////////////////////////////////////////////

/**
 * Only on mock-enabled networks
 * Do nothing if `MockedPrecompile.sol` is already deployed
 */
subtask(TASK_FHEVM_DEPLOY_MOCK_PRECOMPILE)
  .addParam("compileOptions", undefined, undefined, types.any)
  .setAction(async ({ compileOptions }: { compileOptions: FhevmCompileOptions }, hre) => {
    const caps = await hre.fhevm.getProviderCapabilities();
    if (!caps.supportsMock) {
      throw new HardhatFhevmError(
        `Cannot deploy a mock fhevm on network ${hre.fhevm.networkName}. This network does not support mock fhevm.`,
      );
    }

    // Always use hre providers
    const provider = hre.ethers.provider;
    const logOptions = hre.fhevm.logOptions;

    // Deploy MockedPrecompile.sol
    const targetAddress = EXT_TFHE_LIBRARY;

    // We do not check if MockedPrecompile.sol bytecode has changed
    // We only check if the contract is deployed
    const bc = await getDeployedByteCode(targetAddress, provider);
    if (bc !== undefined) {
      logDim(`Code of Mocked Pre-compile already set at address: ${targetAddress}`, logOptions);
      return { address: targetAddress, deploy: false };
    }

    const pi = await hre.fhevm.getProviderRpcMethods();
    if (!pi.setCode) {
      throw new HardhatFhevmError(`Network ${hre.network.name} does not support fhevm mock mode`);
    }

    logTrace(
      "compile fhevm mock coprocessor contract (use on-chain processor: ${onChainFhevmMockProcessor})",
      logOptions,
    );

    // Compile MockedPrecompile.sol
    const dir = zamaWriteMockPrecompileSync(hre.config.paths.fhevm);
    await hre.run(TASK_FHEVM_COMPILE_DIR, { dir, compileOptions });

    const artifact = await hre.artifacts.readArtifact("MockedPrecompile");
    const eth_provider = hre.network.provider;
    await eth_provider.send(pi.setCode, [targetAddress, artifact.deployedBytecode]);

    logDim(`Code of Mocked Pre-compile set at address: ${targetAddress}`, logOptions);

    return { address: targetAddress, deploy: true };
  });

/**
 * Any network
 */
subtask(TASK_FHEVM_DEPLOY)
  .addParam("provider", undefined, undefined, types.any)
  .setAction(async ({ provider }: { provider: EthersT.Provider }, hre) => {
    const contractsRootDir = getUserPackageNodeModulesDir(hre.config);
    const relayerWallet = hre.fhevm.gatewayRelayerWallet(provider);
    const res = await zamaDeploy(contractsRootDir, relayerWallet.address, ZamaDev, provider, hre, hre.fhevm.logOptions);
    return res;
  });

/**
 * Local fhevm node only
 */
subtask(TASK_FHEVM_DEPLOY_EXTRA)
  .addParam("provider", undefined, undefined, types.any)
  .addParam("compileOptions", undefined, undefined, types.any)
  .setAction(
    async ({ provider, compileOptions }: { provider: EthersT.Provider; compileOptions: FhevmCompileOptions }, hre) => {
      const logOptions = hre.fhevm.logOptions;
      // runtime type can be any value
      // must test against the chainid
      const n: EthersT.Network = await provider.getNetwork();
      if (n.chainId !== BigInt(DockerServices.chainId)) {
        logTrace(
          `No extra deployment on network '${hre.network.name}' needed. This network is not a local fhevm node.`,
          logOptions,
        );
        return;
      }

      logTrace("compile gateway bug fix...", logOptions);

      const dir = ____writeGatewayFirstRequestBugAvoider(hre.config.paths.fhevm);
      await hre.run(TASK_FHEVM_COMPILE_DIR, { dir, compileOptions });

      /**
       * First decryption request bug
       * ============================
       * the function '____deployAndRunGatewayFirstRequestBugAvoider' is temporary
       * should be removed when the gateway bug will be fixed
       */
      logTrace("deploy+run gateway bug fix...", logOptions);

      await ____deployAndRunGatewayFirstRequestBugAvoider(ZamaDev, hre, provider);
    },
  );

////////////////////////////////////////////////////////////////////////////////

/**
 * - Called by the built-in TASK_COMPILE task.
 * - Called by the internal TASK_COMPILE_DIR task.
 * - Called by the public TASK_FHEVM_INSTALL_SOLIDITY task.
 */
subtask(TASK_FHEVM_INTERNAL_INSTALL_SOLIDITY)
  .addParam("compileOptions", undefined, undefined, types.any)
  .setAction(async ({ compileOptions }: { compileOptions: FhevmCompileOptions }, hre) => {
    // Can be ready: when running tests, the compile task is executed by the hre just after
    // the fhevm state has been set to ready.
    const contractsRootDir = getUserPackageNodeModulesDir(hre.config);

    // Clean if needed
    const cleanOrBuild = zamaCleanOrBuildNeeded(contractsRootDir, ZamaDev, hre);
    if (cleanOrBuild.clean) {
      logTrace("rebuild needed!", hre.fhevm.logOptions);
      await hre.run(TASK_CLEAN);
    }

    if (compileOptions.onChainFhevmMockProcessor) {
      logDim(`use on chain fast mock executor`, hre.fhevm.logOptions);
    } else {
      logDim(`use standard mock executor`, hre.fhevm.logOptions);
    }

    // Write solidity files only
    // No deploy needed, therefore, no need to compile anything at this point.
    await zamaPrepareCompilationIfNeeded(
      compileOptions,
      contractsRootDir,
      hre.config.paths,
      ZamaDev,
      hre.fhevm.logOptions,
    );
  });

////////////////////////////////////////////////////////////////////////////////

/**
 * Only called by the public TASK_FHEVM_SETUP task
 */
subtask(TASK_FHEVM_START_MOCK).setAction(async ({}, hre) => {
  logTrace("start mock fhevm", hre.fhevm.logOptions);

  assert(await hre.fhevm.useMock());

  const providerType = await hre.fhevm.getProviderType();
  logTrace(`provider: ${providerTypeToString(providerType)}`, hre.fhevm.logOptions);

  const orig_sources_path = hre.config.paths.sources;
  const logOptions = hre.fhevm.logOptions;
  const provider = hre.ethers.provider;
  const contractsRootDir = getUserPackageNodeModulesDir(hre.config);
  const compileOptions = await _getFhevmCompileOptions(hre);

  // Clean if needed
  const cleanOrBuild = zamaCleanOrBuildNeeded(contractsRootDir, ZamaDev, hre);
  if (cleanOrBuild.clean) {
    logTrace("rebuild needed!", hre.fhevm.logOptions);
    await hre.run(TASK_CLEAN);
  }

  // Do nothing if `MockPrecompile.sol` is already deployed
  const mockPrecompile: { address: string; deploy: boolean } = await hre.run(TASK_FHEVM_DEPLOY_MOCK_PRECOMPILE, {
    compileOptions,
  });

  // Do nothing if everything is already done
  if (!cleanOrBuild.clean && !cleanOrBuild.build && !mockPrecompile.deploy) {
    if (await zamaAreContractsDeployed(contractsRootDir, ZamaDev, provider, hre, logOptions)) {
      logTrace("Contracts are already deployed", logOptions);
      return;
    }
  }

  await hre.run(TASK_FHEVM_COMPILE, { compileOptions });

  // Set the minimal balances
  const adminAddresses = _getAdminAddresses(ZamaDev, hre);
  if (await hre.fhevm.canSetBalance()) {
    logTrace("setup accounts balance", logOptions);
    await hre.fhevm.batchSetBalance(adminAddresses, DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.accountsBalance);
  } else {
    logTrace("cannot setup accounts balance", logOptions);
  }

  const deployedContracts = await hre.run(TASK_FHEVM_DEPLOY, { provider });

  // Make sure we are compiling the user contracts
  assert(hre.config.paths.sources === orig_sources_path);

  // logTrace("compile contracts", logOptions);
  // await hre.run(TASK_COMPILE, { quiet: true });

  logStartReport(deployedContracts, hre);
});

////////////////////////////////////////////////////////////////////////////////

/**
 * Return false if already running, true if not
 */
subtask(TASK_FHEVM_START_LOCAL).setAction(async ({}, hre) => {
  if (!(await DockerServices.isDockerRunning())) {
    logBox("Docker is not running (or is in resource saving mode). Please start docker first.", hre.fhevm.logOptions);
    throw new HardhatFhevmError("Docker is not running (or is in resource saving mode). Please start docker first.");
  }

  const dockerServices = new DockerServices(hre, { quiet: false, stderr: true });
  await dockerServices.initWith(ZamaDev, hre.config.fhevmNode);

  const provider = dockerServices.jsonRpcProvider();
  const logOptions = hre.fhevm.logOptions;
  const contractsRootDir = getUserPackageNodeModulesDir(hre.config);
  const compileOptions: FhevmCompileOptions = { onChainFhevmMockProcessor: false };

  const keysNotInstalled = keysInstallNeeded(hre.config.paths.fhevm);

  let deployed = false;
  const fhevmIsRunning = await dockerServices.isFhevmRunning();
  if (fhevmIsRunning) {
    deployed = await zamaAreContractsDeployed(contractsRootDir, ZamaDev, provider, hre, logOptions);
  }

  const cleanOrBuild = zamaCleanOrBuildNeeded(contractsRootDir, ZamaDev, hre);

  if (fhevmIsRunning && !cleanOrBuild.clean && !keysNotInstalled && deployed) {
    if (cleanOrBuild.build) {
      await hre.run(TASK_FHEVM_COMPILE, { compileOptions });
    }

    return false;
  }

  if (fhevmIsRunning) {
    if (keysNotInstalled) {
      logTrace("Restart local fhevm node needed because keys are not installed.", logOptions);
    }
  }

  if (cleanOrBuild.clean) {
    logTrace("rebuild needed!", logOptions);
    await hre.run(TASK_CLEAN);
  }

  logBox("Starting local fhevm node... it might take some time.", logOptions);

  await hre.run(TASK_FHEVM_STOP_LOCAL);
  await hre.run(TASK_FHEVM_COMPILE, { compileOptions });
  await hre.run(TASK_FHEVM_DOCKER_UP, { dockerServices });

  const adminAddresses = _getAdminAddresses(ZamaDev, hre);

  // Special case for admins
  await dockerServices.setBalances(adminAddresses, DEFAULT_LOCAL_FHEVM_ACCOUNTS_CONFIG.accountsBalance);

  const deployedContracts = await hre.run(TASK_FHEVM_DEPLOY, { provider });

  // Deploy any extra contract
  await hre.run(TASK_FHEVM_DEPLOY_EXTRA, { provider, compileOptions });

  const userAddresses = _getUserAddresses(ZamaDev, hre.config.fhevmNode.accounts);

  // Setup user balances with the 'accountsBalance' specified in the 'hardhat.config' + fhevmNode settings
  await dockerServices.setBalances(userAddresses, hre.config.fhevmNode.accounts.accountsBalance);

  logStartReport(deployedContracts, hre);

  // if (cleanOrBuild.build) {
  //   logTrace("compile contracts", hre.fhevm.logOptions);
  //   await hre.run(TASK_COMPILE, { quiet: true });
  // }

  return true;
});

/**
 * Runs on any network
 */
subtask(TASK_FHEVM_STOP_LOCAL).setAction(async ({}, hre: HardhatRuntimeEnvironment) => {
  if (!(await DockerServices.isDockerRunning())) {
    logBox("Docker is not running (or is in resource saving mode). Please start docker first.", hre.fhevm.logOptions);
    throw new HardhatFhevmError("Docker is not running (or is in resource saving mode). Please start docker first.");
  }

  const dockerServices = new DockerServices(hre, { quiet: false, stderr: true });
  await dockerServices.initWith(ZamaDev, hre.config.fhevmNode);

  await hre.run(TASK_FHEVM_DOCKER_DOWN, { dockerServices });
});

function logStartReport(deployedContracts: Record<string, string>, hre: HardhatRuntimeEnvironment) {
  logTrace(`deploy fhevm completed.`, hre.fhevm.logOptions);
  if (hre.fhevm.logOptions.quiet) {
    return;
  }

  // const accounts = hre.config.networks.fhevm.accounts;
  // const col = 25;

  // const lo: LogOptions = hre.fhevm.logOptions;

  // const v: FhevmContractName[] = ["ACL", "TFHEExecutor", "KMSVerifier", "GatewayContract"];
  // v.forEach((name: FhevmContractName) => {
  //   const colName = `${name} owner:`.padEnd(col, " ");
  //   const colAddr = getFhevmContractOwnerSigner(name, hre).address;
  //   logDimWithGreenPrefix(colName, colAddr, lo);
  // });

  // logDimWithGreenPrefix(
  //   "GatewayContract deployer:",
  //   `${getGatewayDeployerWallet(hre).address} (index=${accounts.GatewayContractDeployer}`,
  //   lo,
  // );
  // logDimWithGreenPrefix(
  //   "GatewayContract relayer: ",
  //   `${hre.fhevm.gatewayRelayerAddress()} (private key=${accounts.GatewayRelayerPrivateKey})`,
  //   lo,
  // );

  // v.forEach((name: FhevmContractName) => {
  //   const colName = `${name} address:`.padEnd(col, " ");
  //   const colAddr = deployedContracts[name];
  //   logDimWithGreenPrefix(colName, colAddr, lo);
  // });
}

////////////////////////////////////////////////////////////////////////////////
// Scoped commands
// - npx hardhat fhevm start
// - npx hardhat fhevm stop
// - npx hardhat fhevm restart
// - npx hardhat fhevm clean
////////////////////////////////////////////////////////////////////////////////

const fhevmScope = scope(SCOPE_FHEVM, "Manage a fhevm node");

fhevmScope
  .task(SCOPE_FHEVM_TASK_START)
  .setDescription("Starts a local fhevm node")
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: HardhatFhevmRuntimeLogOptions, hre) => {
    hre.fhevm.logOptions = { quiet, stderr };

    // returns true if started, false if already running
    const started = await hre.run(TASK_FHEVM_START_LOCAL);

    if (!started) {
      logTrace("fhevm already running.", hre.fhevm.logOptions);
    }
  });

fhevmScope
  .task(SCOPE_FHEVM_TASK_STOP)
  .setDescription("Stops any running local fhevm node")
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: HardhatFhevmRuntimeLogOptions, hre) => {
    hre.fhevm.logOptions = { quiet, stderr };
    await hre.run(TASK_FHEVM_STOP_LOCAL);
  });

fhevmScope
  .task(SCOPE_FHEVM_TASK_RESTART)
  .setDescription("Restarts a local fhevm node.")
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: HardhatFhevmRuntimeLogOptions, hre) => {
    await hre.run(TASK_FHEVM_STOP_LOCAL, { quiet, stderr });
    await hre.run(TASK_FHEVM_START_LOCAL, { quiet, stderr });
  });

fhevmScope
  .task(SCOPE_FHEVM_TASK_CLEAN)
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: HardhatFhevmRuntimeLogOptions, hre) => {
    await hre.run({ scope: SCOPE_FHEVM, task: SCOPE_FHEVM_TASK_STOP }, { quiet, stderr });
    logTrace(`remove directory: ${hre.config.paths.fhevm}`, hre.fhevm.logOptions);
    await rimraf(hre.config.paths.fhevm);
  });

////////////////////////////////////////////////////////////////////////////////
// Builtin task: Compile
////////////////////////////////////////////////////////////////////////////////

task(TASK_COMPILE, async (taskArgs: TaskArguments, hre, runSuper) => {
  logTrace("compile contracts", hre.fhevm.logOptions);
  /**
   * If the TASK_COMPILE is called by the internal TASK_COMPILE_DIR
   * use compile options passed as argument.
   */
  const compileOptions = taskArgs.fhevmCompileOptions ?? (await _getFhevmCompileOptions(hre));
  await hre.run(TASK_FHEVM_INTERNAL_INSTALL_SOLIDITY, { compileOptions });
  return runSuper();
});

////////////////////////////////////////////////////////////////////////////////
// Builtin task: Test
////////////////////////////////////////////////////////////////////////////////

task(TASK_TEST, async (_taskArgs, hre, runSuper) => {
  await hre.run(TASK_FHEVM_SETUP, {
    quiet: hre.fhevm.logOptions.quiet === true,
    stderr: hre.fhevm.logOptions.stderr === true,
  });
  return runSuper();
});

////////////////////////////////////////////////////////////////////////////////
// Main API entry point
////////////////////////////////////////////////////////////////////////////////

subtask(TASK_FHEVM_SETUP)
  .addFlag("quiet", undefined)
  .addFlag("stderr", undefined)
  .setAction(async ({ quiet, stderr }: HardhatFhevmRuntimeLogOptions, hre) => {
    hre.fhevm.logOptions = { quiet, stderr };

    if (await hre.fhevm.isReady()) {
      throw new HardhatFhevmError(`Fhevm is already setup`);
    }

    const pt = await hre.fhevm.getProviderType();

    // Do nothing
    if (pt === HardhatFhevmProviderType.Unknown) {
      return;
    }

    if (pt === HardhatFhevmProviderType.Zama) {
      await hre.run(TASK_FHEVM_INSTALL_SOLIDITY);
      hre.fhevm.setReady();
      return;
    }

    if (pt === HardhatFhevmProviderType.Local) {
      await hre.run(TASK_FHEVM_START_LOCAL);
      hre.fhevm.setReady();
      return;
    }

    // Do nothing if user explicitly de-activated the mock fhevm
    if (!(await hre.fhevm.useMock())) {
      return;
    }

    /**
     * Anvil, Hardhat, HardhatNode, Forge
     */
    await hre.run(TASK_FHEVM_START_MOCK);
    hre.fhevm.setReady();
  });

////////////////////////////////////////////////////////////////////////////////
// Install solidity files only
////////////////////////////////////////////////////////////////////////////////

task(TASK_FHEVM_INSTALL_SOLIDITY)
  .setDescription("Install all the required fhevm solidity files associated with the selected network.")
  .setAction(async ({}, hre) => {
    const compileOptions = await _getFhevmCompileOptions(hre);
    await hre.run(TASK_FHEVM_INTERNAL_INSTALL_SOLIDITY, { compileOptions });
  });
