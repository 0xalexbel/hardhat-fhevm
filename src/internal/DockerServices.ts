import { ethers as EthersT } from "ethers";
import rimraf from "rimraf";
import {
  getInstallPrivKeyFile,
  getInstallPubKeyFile,
  getInstallPubKeysDir,
  getInstallServerKeyFile,
  getHHFhevmPackageDir,
  getTmpDir,
  keysInstallNeeded,
  getInstallKeysDir,
} from "./utils/dirs";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import yaml from "yaml";
import dotenv from "dotenv";
import { HardhatFhevmError } from "../error";
import { logBox, logDim, LogOptions, logTrace } from "./log";
import { runCmd, runDocker } from "./utils/run";
import assert from "assert";
import { sleep } from "./utils/timer_utils";
import { applyTemplate, removePrefix } from "./utils/string_utils";
import { JsonRpcProvider } from "ethers";
import { DEFAULT_LOCAL_FHEVM_HTTP_PORT, DEFAULT_LOCAL_FHEVM_WS_PORT, LOCAL_FHEVM_NETWORK_NAME } from "../constants";
import { HardhatFhevmNodeConfig } from "../types";
import { DockerComposeJson, DockerServicesConfig, LOCAL_FHEVM_CHAIN_ID, ServiceNames } from "./DockerServicesConfig";

class DockerServicesPaths {
  public readonly packageDockerDir: string;
  public readonly packageDockerFile: string;
  public readonly installDockerDir: string;
  public readonly keysDir: string;
  public readonly pubKeyFile: string;
  public readonly serverKeyFile: string;
  public readonly privKeyFile: string;
  public readonly installDockerFile: string;

  constructor(dockerRootDir: string) {
    this.packageDockerDir = path.join(getHHFhevmPackageDir(), "docker");
    this.packageDockerFile = path.join(this.packageDockerDir, "docker-compose-full.yml");
    this.installDockerDir = path.normalize(path.join(dockerRootDir, "docker"));
    this.installDockerFile = path.join(this.installDockerDir, "docker-compose-full.yml");
    this.privKeyFile = path.resolve(path.normalize(getInstallPrivKeyFile(dockerRootDir)));
    this.pubKeyFile = path.resolve(path.normalize(getInstallPubKeyFile(dockerRootDir)));
    this.serverKeyFile = path.resolve(path.normalize(getInstallServerKeyFile(dockerRootDir)));
    this.keysDir = path.resolve(path.normalize(getInstallKeysDir(dockerRootDir)));
  }
}

export class DockerServices {
  public readonly logOptions: LogOptions;
  private _config: DockerServicesConfig | undefined;
  private _dockerComposeJson: DockerComposeJson | undefined;
  private _gatewayServiceEnvs: Record<string, string> | undefined;
  private _validatorServiceEnvs: Record<string, string> | undefined;
  private _validatorServiceUrl: string | undefined;
  private _jsonRpcProvider: JsonRpcProvider | undefined;
  private _dockerRootDir: string;
  public readonly paths: DockerServicesPaths;

  constructor(dockerRootDir: string, logOptions: LogOptions) {
    assert(path.isAbsolute(dockerRootDir));
    this._dockerRootDir = dockerRootDir;
    this.logOptions = logOptions;
    this.paths = new DockerServicesPaths(dockerRootDir);
  }

  public get config(): DockerServicesConfig {
    if (!this._config) {
      throw new HardhatFhevmError(`DockerServices is not initialized`);
    }
    return { ...this._config };
  }

  public get initialized() {
    return this._config !== undefined;
  }

  async init(config: DockerServicesConfig) {
    if (this._config) {
      const keys = Object.keys(this._config);
      for (let i = 0; i < keys.length; ++i) {
        const k = keys[i];
        /* eslint-disable @typescript-eslint/no-explicit-any */
        if ((this._config as any)[k] !== (config as any)[k]) {
          throw new HardhatFhevmError(`Conflicting docker config ${k} mismtach`);
        }
      }
    }
    this._config = { ...config };
  }

  async initWith(TFHEExecutorAddress: string, GatewayContractAddress: string, fhevmNodeConfig: HardhatFhevmNodeConfig) {
    const cfg = DockerServices.computeDockerServicesConfig(
      TFHEExecutorAddress,
      GatewayContractAddress,
      fhevmNodeConfig,
    );
    await this.init(cfg);
  }

  public get rootDirectory() {
    return this._dockerRootDir;
  }

  dockerComposeJson(): DockerComposeJson {
    if (!this._dockerComposeJson) {
      const file = fs.readFileSync(this.paths.installDockerFile, "utf8");
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
    try {
      const stdout = await runCmd(`docker compose -f ${this.paths.installDockerFile} ls`, 5000);
      return stdout.indexOf("running(6)") > 0;
    } catch {
      // Docker is not running
      return false;
    }
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

  private async _installDockerFiles(config: DockerServicesConfig) {
    if (!config.FhevmValidatorHttpPort) {
      config.FhevmValidatorHttpPort = DEFAULT_LOCAL_FHEVM_HTTP_PORT;
    }
    if (!config.FhevmValidatorWsPort) {
      config.FhevmValidatorWsPort = DEFAULT_LOCAL_FHEVM_WS_PORT;
    }

    try {
      const src = this.paths.packageDockerDir;
      const dst = this.paths.installDockerDir;

      await fsPromises.cp(src, dst, { recursive: true, dereference: true });

      const TFHEExecutorAddress = config.TFHEExecutorContractAddress;
      const gatewayContractAddress = config.GatewayEthereumOraclePredeployAddress;

      if (!EthersT.isAddress(gatewayContractAddress)) {
        throw new HardhatFhevmError(`Invalid GatewayContract address`);
      }
      if (!EthersT.isAddress(TFHEExecutorAddress)) {
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

    await this._installDockerFiles(config);
    this._dockerDownSync();
    await this.deleteKeys();
  }

  private _dockerDownSync() {
    //docker compose  -f /path/to/docker-compose-full.yml down
    runDocker(["compose", "-f", this.paths.installDockerFile, "down"], this.logOptions);
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

    logTrace(`start docker services on httpPort=${config.FhevmValidatorHttpPort}`, this.logOptions);

    //docker compose  -f /path/to/docker-compose-full.yml down
    runDocker(["compose", "-f", this.paths.installDockerFile, "up", "--detach"], this.logOptions);

    // await this.setBalances(accounts, DEFAULT_LOCAL_FHEVM_ACCOUNT_BALANCE);
  }

  async install() {
    if (!this._config) {
      throw new HardhatFhevmError(`Docker services must be initialized first.`);
    }
    await this.installWithConfig(this._config);
  }

  async installWithConfig(config: DockerServicesConfig) {
    // Install docker files
    await this._installDockerFiles(config);

    if (keysInstallNeeded(this._dockerRootDir)) {
      if (await this.isFhevmRunning()) {
        // Must stop any running docker
        // call docker down directly since docker files have been installed earlier.
        this._dockerDownSync();
      }
    }

    if (!fs.existsSync(this.paths.pubKeyFile) || !fs.existsSync(this.paths.privKeyFile)) {
      await this.createKeys();
    }
  }

  async deleteKeys() {
    try {
      await rimraf(this.paths.keysDir);
    } catch {
      throw new HardhatFhevmError(`Unable to remove keys directory: ${this.paths.keysDir}`);
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
    const dockerRootDir = this._dockerRootDir;

    try {
      fs.mkdirSync(tmpKeysDir, { recursive: true });

      const pubKeysDir = getInstallPubKeysDir(dockerRootDir);
      const privKeysDir = path.dirname(this.paths.privKeyFile);

      runDocker(["pull", dockerImage], this.logOptions);
      runDocker(["create", "--name", "hhfhevm-temp-container", dockerImage], this.logOptions);
      runDocker(["cp", "hhfhevm-temp-container:/app/kms/core/service/keys", tmpDir], this.logOptions);
      runDocker(["rm", "hhfhevm-temp-container"], this.logOptions);

      fs.mkdirSync(privKeysDir, { recursive: true });
      fs.mkdirSync(pubKeysDir, { recursive: true });

      if (!fs.existsSync(pubKeysDir)) {
        throw new HardhatFhevmError("Unable to create fhevm keys directory");
      }

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

      logDim(`Copying server key  to ${this.paths.serverKeyFile}`, this.logOptions);
      fs.copyFileSync(sks, this.paths.serverKeyFile);

      logDim(`Copying public key  to ${this.paths.pubKeyFile}`, this.logOptions);
      fs.copyFileSync(pks, this.paths.pubKeyFile);

      logDim(`Copying private key to ${this.paths.privKeyFile}`, this.logOptions);
      fs.copyFileSync(cks, this.paths.privKeyFile);
    } finally {
      try {
        logDim(`rm -rf ${tmpDir}`, this.logOptions);
        await rimraf.rimraf(tmpDir);
      } catch {
        logDim(`Failed to execute: rm -rf ${tmpDir}`, this.logOptions);
      }
    }
  }

  static computeDockerServicesConfig(
    TFHEExecutorAddress: string,
    GatewayContractAddress: string,
    fhevmNodeConfig: HardhatFhevmNodeConfig,
  ) {
    const httpPort = fhevmNodeConfig.httpPort;
    const wsPort = fhevmNodeConfig.wsPort;

    if (httpPort === wsPort) {
      throw new HardhatFhevmError(`Conflicting ports, fhevm http port should differ from ws port`);
    }

    const dockerConfig: DockerServicesConfig = {
      FhevmValidatorHttpPort: httpPort,
      FhevmValidatorWsPort: wsPort,
      GatewayEthereumRelayerKey: fhevmNodeConfig.gatewayRelayerPrivateKey,
      GatewayEthereumOraclePredeployAddress: GatewayContractAddress,
      TFHEExecutorContractAddress: TFHEExecutorAddress,
    };

    return dockerConfig;
  }
}
