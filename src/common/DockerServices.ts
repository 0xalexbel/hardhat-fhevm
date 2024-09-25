import rimraf from "rimraf";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  getInstallKeysDir,
  getInstallPrivKeyFile,
  getInstallPrivKeysDir,
  getInstallPubKeyFile,
  getInstallPubKeysDir,
  getInstallServerKeyFile,
  getPackageDir,
  getTmpDir,
} from "../dirs";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import yaml from "yaml";
import dotenv from "dotenv";
import { HardhatFhevmError } from "../error";
import { logBox, logDim, LogOptions, logTrace } from "../log";
import { runCmd, runDocker } from "../run";
import assert from "assert";
import { applyTemplate, removePrefix, sleep } from "../utils";
import { JsonRpcProvider } from "ethers";
import {
  DEFAULT_LOCAL_FHEVM_HTTP_PORT,
  DEFAULT_LOCAL_FHEVM_WS_PORT,
  LOCAL_FHEVM_NETWORK_NAME,
  ZamaDevConfig,
} from "../constants";
import { zamaComputeContractAddresses } from "./zamaContracts";
import { FhevmNodeConfig } from "../types";

export type DockerServicesConfig = {
  FhevmValidatorHttpPort: number;
  FhevmValidatorWsPort: number;
  TFHEExecutorContractAddress: string;
  GatewayEthereumRelayerKey: string;
  GatewayEthereumOraclePredeployAddress: string;
};

type DockerComposeJson = {
  name: string;
  services: {
    "fhevm-validator": {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      environment: any;
      image: string;
      ports: string[];
    };
    gateway: {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      environment: any;
      image: string;
      ports: string[];
    };
    "kms-core": {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      environment: any;
      image: string;
      ports: string[];
    };
  };
};

const ServiceNames: Record<string, keyof DockerComposeJson["services"]> = {
  validator: "fhevm-validator",
  gateway: "gateway",
  kmsCore: "kms-core",
};

export const LOCAL_FHEVM_CHAIN_ID: number = 9000;

export class DockerServices {
  private hre: HardhatRuntimeEnvironment;
  public readonly packageDockerDir: string;
  public readonly packageDockerFile: string;
  public readonly installDockerDir: string;
  public readonly keysAbsoluteDir: string;
  public readonly installDockerFile: string;
  public readonly logOptions: LogOptions;
  private _config: DockerServicesConfig | undefined;
  private _dockerComposeJson: DockerComposeJson | undefined;
  private _gatewayServiceEnvs: Record<string, string> | undefined;
  private _validatorServiceEnvs: Record<string, string> | undefined;
  private _validatorServiceUrl: string | undefined;
  private _jsonRpcProvider: JsonRpcProvider | undefined;

  constructor(hre: HardhatRuntimeEnvironment, logOptions: LogOptions) {
    this.hre = hre;
    this.logOptions = logOptions;
    const dir = getPackageDir();
    this.packageDockerDir = path.join(dir, "docker");
    this.packageDockerFile = path.join(this.packageDockerDir, "docker-compose-full.yml");

    const fhevmPath = hre.config.paths.fhevm;
    this.installDockerDir = path.normalize(path.join(fhevmPath, "docker"));
    this.installDockerFile = path.join(this.installDockerDir, "docker-compose-full.yml");

    this.keysAbsoluteDir = path.resolve(path.normalize(getInstallPubKeysDir(fhevmPath)));
  }

  dockerComposeJson(): DockerComposeJson {
    if (!this._dockerComposeJson) {
      const file = fs.readFileSync(this.installDockerFile, "utf8");
      this._dockerComposeJson = yaml.parse(file);
      if (!this._dockerComposeJson) {
        throw new HardhatFhevmError("error");
      }
    }
    return this._dockerComposeJson;
  }

  validatorService() {
    return this.dockerComposeJson().services[ServiceNames.validator];
  }

  gatewayService() {
    return this.dockerComposeJson().services[ServiceNames.gateway];
  }

  kmsCoreService() {
    return this.dockerComposeJson().services[ServiceNames.kmsCore];
  }

  kmsCoreServiceDockerImage() {
    return this.dockerComposeJson().services[ServiceNames.kmsCore].image;
  }

  gatewayServiceEnvs() {
    try {
      if (!this._gatewayServiceEnvs) {
        const envs = this.gatewayService().environment.join("\n");
        this._gatewayServiceEnvs = dotenv.parse(envs);
      }
      return this._gatewayServiceEnvs;
    } catch {
      throw new HardhatFhevmError(`Unable to parse gateway service environment variables`);
    }
  }

  gatewayServiceRelayerPrivateKey() {
    try {
      return this.gatewayServiceEnvs()["GATEWAY__ETHEREUM__RELAYER_KEY"]!;
    } catch {
      throw new HardhatFhevmError(`Unable to parse gateway service relayer private key environment variables`);
    }
  }

  gatewayServicePort(): number {
    const srv = this.gatewayService();
    const ranges = srv.ports;
    if (!ranges || !Array.isArray(ranges) || ranges.length !== 1 || !ranges[0]) {
      throw new HardhatFhevmError("Unable to retreive gateway service port");
    }
    const range = ranges[0].split(":");

    const port = Number.parseInt(range[0]);
    if (Number.isNaN(port)) {
      throw new HardhatFhevmError("Unable to retreive gateway service port");
    }
    assert(port === 7077);
    return port;
  }

  gatewayServiceUrl(): string {
    return `http://localhost:${this.gatewayServicePort()}`;
  }

  validatorServiceEnvs() {
    try {
      if (!this._validatorServiceEnvs) {
        const envs = this.validatorService().environment.join("\n");
        this._validatorServiceEnvs = dotenv.parse(envs);
      }
      return this._validatorServiceEnvs;
    } catch {
      throw new HardhatFhevmError(`Unable to parse gateway service environment variables`);
    }
  }

  validatorServiceUrl() {
    if (this._config) {
      return "http://localhost:" + this._config.FhevmValidatorHttpPort;
    }
    return this._parseValidatorServiceUrl();
  }

  private _parseValidatorServiceUrl() {
    try {
      if (!this._validatorServiceUrl) {
        const ports = this.validatorService().ports;
        // Hardcoded
        for (let i = 0; i < ports.length; ++i) {
          const r = ports[i].split(":");
          if (r.length !== 2) {
            throw new Error();
          }
          if (r[1] !== "8545") {
            continue;
          }
          // if (r[1] !== "8545-8546") {
          //   continue;
          // }
          // const range = r[0].split("-");
          const port = Number.parseInt(r[0]);
          if (Number.isNaN(port) || !Number.isFinite(port)) {
            throw new Error();
          }

          this._validatorServiceUrl = "http://localhost:" + port;
          return this._validatorServiceUrl;
        }
        throw new Error();
      }
      return this._validatorServiceUrl;
    } catch {
      throw new HardhatFhevmError(`Unable to parse Fhevm Validator service ports in Docker compose file.`);
    }
  }

  parseValidatorContainerName() {
    const validatorServiceName = ServiceNames.validator;
    const validatorServiceIndex = 1;
    const json = this.dockerComposeJson();
    return `${json.name}-${validatorServiceName}-${validatorServiceIndex}`;
  }

  static get chainId() {
    return LOCAL_FHEVM_CHAIN_ID;
  }

  jsonRpcProvider() {
    if (!this._jsonRpcProvider) {
      this._jsonRpcProvider = new JsonRpcProvider(this.validatorServiceUrl(), {
        chainId: DockerServices.chainId,
        name: LOCAL_FHEVM_NETWORK_NAME,
      });
    }
    return this._jsonRpcProvider;
  }

  async isFhevmRunning(): Promise<boolean> {
    const stdout = await runCmd(`docker compose -f ${this.installDockerFile} ls`, 5000);
    return stdout.indexOf("running(6)") > 0;
  }

  static async isDockerRunning(): Promise<boolean> {
    try {
      await runCmd("docker images", 2000);
      return true;
    } catch {
      return false;
    }
  }

  async setBalances(addresses: Array<string>, amount: string) {
    const promises = addresses.map((address: string, index: number) => {
      return this._setBalance(address, amount, index);
    });
    await Promise.all(promises);
  }

  async setBalance(address: string, amount: string) {
    return this._setBalance(address, amount, undefined);
  }

  private async _setBalance(address: string, amount: string, walletIndex?: number) {
    const amountBn = BigInt(amount);
    const currentBalance = await this.jsonRpcProvider().getBalance(address);
    if (currentBalance >= amountBn) {
      return;
    }

    const containerName = this.parseValidatorContainerName();

    let ok = false;
    while (!ok) {
      //use FAUCET_AMOUNT env var to specify the amout
      const stdout = await runCmd(
        `docker exec -e FAUCET_AMOUNT=${amount} -i ${containerName} faucet ${address} | grep height`,
      );
      const res = JSON.parse(stdout);
      if (!res.raw_log.match("account sequence mismatch")) {
        ok = true;
        break;
      }
      await sleep(200);
    }

    const maxRetry = 50;
    let i = 0;
    while (i < maxRetry) {
      //const balance = await this.hre.fhevm.provider().getBalance(address);
      const balance = await this.jsonRpcProvider().getBalance(address);
      if (balance > 0) {
        if (walletIndex !== undefined) {
          logDim(`${address} balance=${balance} (wallet index=${walletIndex})`, this.logOptions);
        } else {
          logDim(`${address} balance=${balance}`, this.logOptions);
        }
        return;
      }
      await sleep(1000);
      i++;
    }

    if (walletIndex !== undefined) {
      logDim(`${address} balance=??? (wallet index=${walletIndex})`, this.logOptions);
    } else {
      logDim(`${address} balance=???`, this.logOptions);
    }
  }

  private async _installFiles(config: DockerServicesConfig) {
    if (!config.FhevmValidatorHttpPort) {
      config.FhevmValidatorHttpPort = DEFAULT_LOCAL_FHEVM_HTTP_PORT;
    }
    if (!config.FhevmValidatorWsPort) {
      config.FhevmValidatorWsPort = DEFAULT_LOCAL_FHEVM_WS_PORT;
    }

    try {
      const src = this.packageDockerDir;
      const dst = this.installDockerDir;

      await fsPromises.cp(src, dst, { recursive: true, dereference: true });

      const TFHEExecutorAddress = config.TFHEExecutorContractAddress;
      const gatewayContractAddress = config.GatewayEthereumOraclePredeployAddress;

      if (!this.hre.ethers.isAddress(gatewayContractAddress)) {
        throw new HardhatFhevmError(`Invalid GatewayContract address`);
      }
      if (!this.hre.ethers.isAddress(TFHEExecutorAddress)) {
        throw new HardhatFhevmError(`Invalid TFHEExecutor address`);
      }
      if (!config.GatewayEthereumRelayerKey) {
        throw new HardhatFhevmError(`Invalid Gateway relayer key`);
      }

      const values: [string, string][] = [
        ["GatewayRelayerPrivateKey", config.GatewayEthereumRelayerKey],
        ["GatewayContractAddress", removePrefix(gatewayContractAddress, "0x")],
        ["TFHEExecutorAddress", TFHEExecutorAddress],
        ["httpPort", config.FhevmValidatorHttpPort.toPrecision()],
        ["wsPort", config.FhevmValidatorWsPort.toPrecision()],
        //["EXT_TFHE_LIBRARY", EXT_TFHE_LIBRARY],
      ];

      const templatePath = path.join(dst, "docker-compose-full-template.yml");
      const templateContent = fs.readFileSync(templatePath, "utf8");

      const finalContent = applyTemplate(templateContent, values);
      const finalPath = path.join(dst, "docker-compose-full.yml");

      fs.writeFileSync(finalPath, finalContent, { encoding: "utf8", flag: "w" });

      rimraf.rimrafSync(templatePath);
    } catch (err) {
      throw new HardhatFhevmError(`Unable to install docker files ${err}`);
    }
  }

  async initWith(config: ZamaDevConfig, fhevmNodeConfig: FhevmNodeConfig) {
    const cfg = DockerServices.computeDockerServicesConfig(config, fhevmNodeConfig);
    await this.init(cfg);
  }

  async init(config: DockerServicesConfig) {
    if (this._config) {
      const keys = Object.keys(this._config);
      for (let i = 0; i < keys.length; ++i) {
        const k = keys[i];
        if ((this._config as any)[k] !== (config as any)[k]) {
          throw new HardhatFhevmError(`Conflicting docker config ${k} mismtach`);
        }
      }
    }
    this._config = { ...config };
  }

  async down() {
    if (!this._config) {
      throw new HardhatFhevmError(`Docker services must be initialized first.`);
    }
    await this.downWithConfig(this._config);
  }

  async downWithConfig(config: DockerServicesConfig) {
    if (!(await DockerServices.isDockerRunning())) {
      logBox("Docker is not running (or is in resource saving mode). Please start docker first.", this.logOptions);
      throw new HardhatFhevmError("Docker is not running (or is in resource saving mode). Please start docker first.");
    }

    logTrace("stop docker services", this.logOptions);

    await this._installFiles(config);
    //docker compose  -f /path/to/docker-compose-full.yml down
    runDocker(["compose", "-f", this.installDockerFile, "down"], this.logOptions);

    await this.deleteKeys();
  }

  async up(/*accounts: string[]*/) {
    if (!this._config) {
      throw new HardhatFhevmError(`Docker services must be initialized first.`);
    }
    await this.upWithConfig(this._config /*, accounts*/);
  }

  async upWithConfig(config: DockerServicesConfig /*accounts: string[]*/) {
    if (!(await DockerServices.isDockerRunning())) {
      logBox("Docker is not running (or is in resource saving mode). Please start docker first.", this.logOptions);
      throw new HardhatFhevmError("Docker is not running (or is in resource saving mode). Please start docker first.");
    }

    await this.installWithConfig(config);

    logTrace("start docker services", this.logOptions);

    //docker compose  -f /path/to/docker-compose-full.yml down
    runDocker(["compose", "-f", this.installDockerFile, "up", "--detach"], this.logOptions);

    // await this.setBalances(accounts, DEFAULT_LOCAL_FHEVM_ACCOUNT_BALANCE);
  }

  async install() {
    if (!this._config) {
      throw new HardhatFhevmError(`Docker services must be initialized first.`);
    }
    await this.installWithConfig(this._config);
  }

  async installWithConfig(config: DockerServicesConfig) {
    await this._installFiles(config);

    if (!fs.existsSync(this.keysAbsoluteDir)) {
      await this.createKeys();
    }
  }

  async deleteKeys() {
    const keysDir = getInstallKeysDir(this.hre.config.paths.fhevm);
    try {
      await rimraf(keysDir);
    } catch {
      throw new HardhatFhevmError(`Unable to remove keys directory: ${keysDir}`);
    }
  }

  async createKeys() {
    logTrace("setup fhevm keys", this.logOptions);
    const dockerImage = this.kmsCoreServiceDockerImage();

    let gatewayKmsKeyID;
    try {
      const gatewayEnvs = this.gatewayServiceEnvs();
      gatewayKmsKeyID = gatewayEnvs.GATEWAY__KMS__KEY_ID;
    } catch {
      throw new HardhatFhevmError(`Unable to retreive gateway kms key ID`);
    }

    const tmpDir = getTmpDir();
    const tmpKeysDir = path.join(tmpDir, "keys");
    const fhevmPath = this.hre.config.paths.fhevm;

    try {
      fs.mkdirSync(tmpKeysDir, { recursive: true });
      const pubKeysDir = getInstallPubKeysDir(fhevmPath);
      const privKeysDir = getInstallPrivKeysDir(fhevmPath);

      runDocker(["pull", dockerImage], this.logOptions);
      runDocker(["create", "--name", "hhfhevm-temp-container", dockerImage], this.logOptions);
      runDocker(["cp", "hhfhevm-temp-container:/app/kms/core/service/keys", tmpDir], this.logOptions);
      runDocker(["rm", "hhfhevm-temp-container"], this.logOptions);

      fs.mkdirSync(privKeysDir, { recursive: true });
      fs.mkdirSync(pubKeysDir, { recursive: true });

      const sks = path.join(tmpKeysDir, "PUB/ServerKey", gatewayKmsKeyID);
      if (!fs.existsSync(sks)) {
        throw new HardhatFhevmError("Unable to retreive server key file");
      }
      const pks = path.join(tmpKeysDir, "PUB/PublicKey", gatewayKmsKeyID);
      if (!fs.existsSync(pks)) {
        throw new HardhatFhevmError("Unable to retreive public key file");
      }
      const cks = path.join(tmpKeysDir, "PRIV/FhePrivateKey", gatewayKmsKeyID);
      if (!fs.existsSync(cks)) {
        throw new HardhatFhevmError("Unable to retreive private key file");
      }

      logDim(`Copying server key  to ${pubKeysDir}/sks`, this.logOptions);
      fs.copyFileSync(sks, getInstallServerKeyFile(fhevmPath));

      logDim(`Copying public key  to ${pubKeysDir}/pks`, this.logOptions);
      fs.copyFileSync(pks, getInstallPubKeyFile(fhevmPath));

      logDim(`Copying private key to ${privKeysDir}/cks`, this.logOptions);
      fs.copyFileSync(cks, getInstallPrivKeyFile(fhevmPath));

      if (!fs.existsSync(this.keysAbsoluteDir)) {
        throw new HardhatFhevmError("Unable to create fhevm keys directory");
      }
    } finally {
      try {
        logDim(`rm -rf ${tmpDir}`, this.logOptions);
        await rimraf.rimraf(tmpDir);
      } catch {
        logDim(`Failed to execute: rm -rf ${tmpDir}`, this.logOptions);
      }
    }
  }

  static computeDockerServicesConfig(config: ZamaDevConfig, fhevmNodeConfig: FhevmNodeConfig) {
    const addresses = zamaComputeContractAddresses(config);

    const httpPort = fhevmNodeConfig.httpPort;
    const wsPort = fhevmNodeConfig.wsPort;

    if (httpPort === wsPort) {
      throw new HardhatFhevmError(`Conflicting ports, fhevm http port should differ from ws port`);
    }

    const dockerConfig: DockerServicesConfig = {
      FhevmValidatorHttpPort: httpPort,
      FhevmValidatorWsPort: wsPort,
      GatewayEthereumRelayerKey: fhevmNodeConfig.gatewayRelayerPrivateKey,
      GatewayEthereumOraclePredeployAddress: addresses.GatewayContract,
      TFHEExecutorContractAddress: addresses.TFHEExecutor,
    };

    return dockerConfig;
  }
}
