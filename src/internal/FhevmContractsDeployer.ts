import assert from "assert";
import { EXT_TFHE_LIBRARY } from "../constants";
import { HardhatFhevmError } from "../error";
import { ethers as EthersT } from "ethers";
import { logDim, LogOptions, logTrace } from "./log";
import { FhevmDeployOptions, FhevmContractName, ProviderRpcMethods } from "./types";
import { FhevmContractsRepository } from "./FhevmContractsRepository";
import { FhevmEnvironment } from "./FhevmEnvironment";
import { Artifacts, EthereumProvider } from "hardhat/types";
import {
  getDeployedAddress,
  getDeployedByteCode,
  isDeployed,
  deployContractUsingSetCode,
  deployContract,
} from "./utils/eth_utils";

export class FhevmContractsDeployer {
  private _repository: FhevmContractsRepository;
  private _fhevmEnv: FhevmEnvironment;
  private _deployOptions: FhevmDeployOptions;
  private _logOptions: LogOptions;
  private _rpcMethods: ProviderRpcMethods;
  private _networkName: string | undefined;
  private _ethProvider: EthereumProvider | undefined;
  private _provider: EthersT.Provider | undefined;
  private _artifacts: Artifacts;

  private static __constructorGuard: boolean = true;

  constructor(fhevmEnv: FhevmEnvironment, rpcMethods: ProviderRpcMethods) {
    if (FhevmContractsDeployer.__constructorGuard) {
      throw new HardhatFhevmError(`FhevmContractsDeployer constructor is not accessible, use static create`);
    }
    FhevmContractsDeployer.__constructorGuard = true;

    this._fhevmEnv = fhevmEnv;
    this._deployOptions = fhevmEnv.deployOptions;
    this._logOptions = fhevmEnv.logOptions;
    this._repository = fhevmEnv.repository;
    this._rpcMethods = rpcMethods;
    this._networkName = fhevmEnv.networkName;
    this._ethProvider = fhevmEnv.ethProvider;
    this._provider = this._deployOptions.provider;
    this._artifacts = fhevmEnv.artifacts;
  }

  public static async create(fhevmEnv: FhevmEnvironment): Promise<FhevmContractsDeployer> {
    const rpcMethods = await fhevmEnv.getProviderRpcMethods();

    assert(FhevmContractsDeployer.__constructorGuard);
    FhevmContractsDeployer.__constructorGuard = false;

    return new FhevmContractsDeployer(fhevmEnv, rpcMethods);
  }

  public async deploy(gatewayRelayerWalletAddress: string) {
    logTrace("deploy fhevm contracts", this._logOptions);

    // Warning !! follow the deploy order below because of the predefined nonce values
    // Improvements: write a loop to compute the order automatically based of the various deployers

    const ACL = await this._deployACL();
    const TFHEExecutor = await this._deployTFHEExecutor();
    const KMSVerifier = await this._deployKMSVerifier();
    const GatewayContract = await this._deployGatewayContract(gatewayRelayerWalletAddress);

    // Last in nonce order
    let MockedPrecompile = undefined;
    if (this._deployOptions.mock) {
      const res = await this._deployMockPrecompile();
      MockedPrecompile = {
        MockedPrecompile: res,
      };
    }

    return {
      ACL,
      TFHEExecutor,
      KMSVerifier,
      GatewayContract,
      ...MockedPrecompile,
    };
  }

  private async _deployACL(): Promise<{ address: string; alreadyDeployed: boolean }> {
    const tfhe_executor_addr = this._repository.readAddressFromSolidityFileSync("TFHEExecutor");
    const res = await this._deployFhevmContract("ACL", [tfhe_executor_addr], false);
    return res;
  }

  private async _deployTFHEExecutor(): Promise<{ address: string; alreadyDeployed: boolean }> {
    const res = await this._deployFhevmContract("TFHEExecutor", [], false);
    return res;
  }

  private async _deployKMSVerifier(): Promise<{ address: string; alreadyDeployed: boolean }> {
    const res = await this._deployFhevmContract("KMSVerifier", [], false);
    return res;
  }

  private async _deployGatewayContract(
    gatewayRelayerWalletAddress: string,
  ): Promise<{ address: string; alreadyDeployed: boolean }> {
    if (!this._provider) {
      throw new HardhatFhevmError(`Missing provider`);
    }
    const ownerWallet = this._repository.getOwnerWallet("GatewayContract", this._provider);
    assert(ownerWallet);

    const kms_verifier_addr = this._repository.readAddressFromSolidityFileSync("KMSVerifier");
    if (!kms_verifier_addr) {
      throw new HardhatFhevmError(`Unable to deploy GatewayContract, missing KMSVerifier address`);
    }

    // deploy Gateway contract
    const res = await this._deployFhevmContract("GatewayContract", [ownerWallet.address, kms_verifier_addr], false);

    // add Gateway relayer
    await this.addGatewayRelayer(res.address, ownerWallet, gatewayRelayerWalletAddress);

    return res;
  }

  private async _deployMockPrecompile(): Promise<{ address: string; alreadyDeployed: boolean }> {
    const targetAddress = this._repository.computeAddress("MockedPrecompile", this._deployOptions);
    // use setCode if target is EXT_TFHE_LIBRARY
    const res = await this._deployFhevmContract("MockedPrecompile", [], targetAddress === EXT_TFHE_LIBRARY);
    return res;
  }

  //////////////////////////////////////////////////////////////////////////////

  private async _deployFhevmContract(
    contractName: FhevmContractName,
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    args: any[],
    useSetCode: boolean,
  ): Promise<{ address: string; alreadyDeployed: boolean }> {
    const computedAddr = this._repository.computeAddress(contractName, this._deployOptions);

    let res: {
      address: string;
      alreadyDeployed: boolean;
      deployer?: string;
    };

    if (useSetCode) {
      // does not support setCode with constructor arguments yet.
      assert(args.length === 0);
      if (!this._rpcMethods.setCode) {
        if (!this._networkName) {
          throw new HardhatFhevmError(`Network does not support fhevm mock mode`);
        } else {
          throw new HardhatFhevmError(`Network '${this._networkName}' does not support fhevm mock mode`);
        }
      }

      res = await this._deployContractUsingSetCode(computedAddr, contractName, this._rpcMethods.setCode);
    } else {
      res = await this._deployContract(computedAddr, contractName, args);
    }

    const deployerStr = res.deployer ?? "???";
    if (res.alreadyDeployed) {
      logDim(
        `${contractName.padEnd(16, " ")} is already deployed at ${res.address} (deployer=${deployerStr})`,
        this._logOptions,
      );
    } else {
      logDim(`${contractName.padEnd(16, " ")} deployed at ${res.address} (deployer=${deployerStr})`, this._logOptions);
    }

    return res;
  }

  //////////////////////////////////////////////////////////////////////////////

  private async _deployContract(
    computedAddress: string,
    contractName: FhevmContractName,
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    args: any[],
  ): Promise<{ address: string; alreadyDeployed: boolean; deployer: string }> {
    if (!this._provider) {
      return {
        address: EthersT.ZeroAddress,
        alreadyDeployed: false,
        deployer: EthersT.ZeroAddress,
      };
    }

    const deployer = this._repository.getDeployerWallet(contractName, this._provider);

    let address;
    let expectedAddr;
    try {
      expectedAddr = this._repository.readAddressFromSolidityFileSync(contractName);
      if (!expectedAddr) {
        throw new Error("unable to read env address.");
      }
      if (expectedAddr !== computedAddress) {
        throw new Error("env address and computed address differ.");
      }
      if (await getDeployedAddress(expectedAddr, this._provider)) {
        return { address: expectedAddr, alreadyDeployed: true, deployer: deployer.address };
      }

      const contract = await deployContract(
        this._repository.getFullyQualifiedName(contractName),
        args,
        deployer,
        this._fhevmEnv,
      );

      address = await contract.getAddress();
    } catch (err) {
      throw new HardhatFhevmError(`Deploy contract ${contractName} failed (signer=${deployer.address}), ${err}`);
    }

    if (address.toLowerCase() !== expectedAddr.toLowerCase()) {
      throw new HardhatFhevmError(
        `The nonce of the deployer account is not corret. Please relaunch a clean instance of the fhEVM`,
      );
    }

    return { address, alreadyDeployed: false, deployer: deployer.address };
  }

  //////////////////////////////////////////////////////////////////////////////

  private async _deployContractUsingSetCode(
    targetAddress: string,
    contractName: FhevmContractName,
    setCodeRpcMethod: string,
  ): Promise<{ address: string; alreadyDeployed: boolean }> {
    // ethProvider must be defined when using setCode
    assert(this._ethProvider);

    if (!this._provider) {
      return {
        address: EthersT.ZeroAddress,
        alreadyDeployed: false,
      };
    }

    const bc = await getDeployedByteCode(targetAddress, this._provider);
    if (bc !== undefined) {
      return { address: targetAddress, alreadyDeployed: true };
    }

    await deployContractUsingSetCode(
      targetAddress,
      this._repository.getFullyQualifiedName(contractName),
      setCodeRpcMethod,
      this._provider,
      this._ethProvider,
      this._artifacts,
    );

    return { address: targetAddress, alreadyDeployed: false };
  }

  //////////////////////////////////////////////////////////////////////////////

  public async addGatewayRelayer(
    gatewayContractAddress: string,
    owner: EthersT.HDNodeWallet,
    relayerWalletAddress: string,
  ) {
    if (!(await isDeployed(gatewayContractAddress, this._provider))) {
      throw new HardhatFhevmError(`${gatewayContractAddress} is not a smart contract`);
    }
    // isDeployed is true => this._provider is defined
    assert(this._provider);
    assert(owner.provider);

    const factory = await this._repository.getFactory("GatewayContract", this._provider, this._fhevmEnv);
    const gatewayContract = factory.attach(gatewayContractAddress).connect(owner) as EthersT.Contract;

    const _relayerAddress = EthersT.getAddress(relayerWalletAddress);

    const is_relayer = await gatewayContract.isRelayer(_relayerAddress);
    if (is_relayer) {
      logDim(`Account ${_relayerAddress} is already a gateway relayer`, this._logOptions);
      return;
    }

    /* eslint-disable @typescript-eslint/ban-ts-comment */
    //@ts-ignore
    const tx = await gatewayContract.addRelayer(_relayerAddress);
    const receipt = await tx.wait();
    if (receipt!.status === 1) {
      logDim(`Account ${_relayerAddress} was succesfully added as a gateway relayer`, this._logOptions);
    } else {
      throw new HardhatFhevmError("Add gateway relayer failed.");
    }
  }
}
