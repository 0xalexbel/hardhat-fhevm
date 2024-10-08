import { getInstallPubKeysDir, getHHFhevmPackageDir, keysInstallNeeded } from "./utils/dirs";
import path from "path";
import fs from "fs";
import yaml from "yaml";
import dotenv from "dotenv";
import { HardhatFhevmError } from "../error";
import assert from "assert";
import { DockerComposeJson, DockerServicesConfig, ServiceNames } from "./DockerServicesConfig";

export class DockerServicesReader {
  public readonly packageDockerDir: string;
  public readonly packageDockerFile: string;
  public readonly installDockerDir: string;
  public readonly pubKeysAbsoluteDir: string;
  public readonly installDockerFile: string;
  private _dockerComposeJson: DockerComposeJson | undefined;
  private _gatewayServiceEnvs: Record<string, string> | undefined;
  private _validatorServiceEnvs: Record<string, string> | undefined;
  private _validatorServiceUrl: string | undefined;
  private _validatorHttpPort: number | undefined;
  private _validatorWsPort: number | undefined;
  private _dockerRootDir: string;

  constructor(dockerRootDir: string) {
    this._dockerRootDir = dockerRootDir;

    this.packageDockerDir = path.join(getHHFhevmPackageDir(), "docker");
    this.packageDockerFile = path.join(this.packageDockerDir, "docker-compose-full.yml");

    this.installDockerDir = path.normalize(path.join(dockerRootDir, "docker"));
    this.installDockerFile = path.join(this.installDockerDir, "docker-compose-full.yml");
    this.pubKeysAbsoluteDir = path.resolve(path.normalize(getInstallPubKeysDir(dockerRootDir)));
  }

  public isRestartNeeded(config: DockerServicesConfig): { restartNeeded: boolean; reason?: string } {
    if (!fs.existsSync(this.installDockerFile)) {
      return { restartNeeded: true, reason: "Docker file does not exist" };
    }
    if (keysInstallNeeded(this._dockerRootDir)) {
      return { restartNeeded: true, reason: "Keys are not installed" };
    }
    const parsedConfig = this.config();
    const keys = Object.keys(parsedConfig);
    let reason = "";
    const yes = keys.some((v) => {
      const changed = parsedConfig[v as keyof DockerServicesConfig] !== config[v as keyof DockerServicesConfig];
      if (changed) {
        reason = `${v} differs: ${parsedConfig[v as keyof DockerServicesConfig]} != ${config[v as keyof DockerServicesConfig]}`;
      }
      return changed;
    });
    if (yes) {
      return { restartNeeded: true, reason: `Docker parameters have changed, ${reason}` };
    }
    return { restartNeeded: false };
  }

  dockerComposeJson(): DockerComposeJson | undefined {
    if (!fs.existsSync(this.installDockerFile)) {
      return undefined;
    }
    if (this._dockerComposeJson === undefined) {
      const file = fs.readFileSync(this.installDockerFile, "utf8");
      this._dockerComposeJson = yaml.parse(file);
      if (!this._dockerComposeJson) {
        throw new HardhatFhevmError("error");
      }
    }
    return this._dockerComposeJson;
  }

  public config() {
    const ports = this.validatorServicePorts();
    return {
      FhevmValidatorHttpPort: ports?.http,
      FhevmValidatorWsPort: ports?.ws,
      GatewayEthereumRelayerKey: this.gatewayServiceRelayerPrivateKey(),
      GatewayEthereumOraclePredeployAddress: this.gatewayContractAddress(),
      TFHEExecutorContractAddress: this.tfheExecutorAddress(),
    };
  }

  validatorService() {
    return this.dockerComposeJson()?.services[ServiceNames.validator];
  }

  gatewayService() {
    return this.dockerComposeJson()?.services[ServiceNames.gateway];
  }

  kmsCoreService() {
    return this.dockerComposeJson()?.services[ServiceNames.kmsCore];
  }

  kmsCoreServiceDockerImage() {
    return this.dockerComposeJson()?.services[ServiceNames.kmsCore].image;
  }

  gatewayServiceEnvs() {
    try {
      if (!this._gatewayServiceEnvs) {
        const srv = this.gatewayService();
        if (!srv) {
          return undefined;
        }
        const envs = srv.environment.join("\n");
        this._gatewayServiceEnvs = dotenv.parse(envs);
      }
      return this._gatewayServiceEnvs;
    } catch {
      throw new HardhatFhevmError(`Unable to parse gateway service environment variables`);
    }
  }

  tfheExecutorAddress() {
    try {
      const ens = this.validatorServiceEnvs();
      if (!ens) {
        return undefined;
      }
      let addr = ens["TFHE_EXECUTOR_CONTRACT_ADDRESS"]!;
      if (!addr.startsWith("0x")) {
        addr = "0x" + addr;
      }
      return addr;
    } catch {
      throw new HardhatFhevmError(`Unable to parse validator service executor contract address environment variables`);
    }
  }

  gatewayContractAddress() {
    try {
      const ens = this.gatewayServiceEnvs();
      if (!ens) {
        return undefined;
      }
      let addr = ens["GATEWAY__ETHEREUM__ORACLE_PREDEPLOY_ADDRESS"]!;
      if (!addr.startsWith("0x")) {
        addr = "0x" + addr;
      }
      return addr;
    } catch {
      throw new HardhatFhevmError(`Unable to parse gateway service relayer contract address environment variables`);
    }
  }

  gatewayServiceRelayerPrivateKey() {
    try {
      const ens = this.gatewayServiceEnvs();
      if (!ens) {
        return undefined;
      }
      return ens["GATEWAY__ETHEREUM__RELAYER_KEY"]!;
    } catch {
      throw new HardhatFhevmError(`Unable to parse gateway service relayer private key environment variables`);
    }
  }

  gatewayServicePort(): number | undefined {
    const srv = this.gatewayService();
    if (!srv) {
      return undefined;
    }
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

  gatewayServiceUrl(): string | undefined {
    const port = this.gatewayServicePort();
    if (port === undefined) {
      return undefined;
    }
    return `http://localhost:${port}`;
  }

  validatorServiceEnvs() {
    try {
      if (!this._validatorServiceEnvs) {
        const srv = this.validatorService();
        if (!srv) {
          return undefined;
        }
        const envs = srv.environment.join("\n");
        this._validatorServiceEnvs = dotenv.parse(envs);
      }
      return this._validatorServiceEnvs;
    } catch {
      throw new HardhatFhevmError(`Unable to parse gateway service environment variables`);
    }
  }

  validatorServiceUrl() {
    if (this._validatorServiceUrl === undefined) {
      const ports = this.validatorServicePorts();
      if (!ports) {
        return undefined;
      }
      this._validatorServiceUrl = `http://localhost:${ports.http}`;
    }

    return this._validatorServiceUrl;
  }

  validatorServicePorts() {
    try {
      if (this._validatorHttpPort === undefined) {
        const srv = this.validatorService();
        if (!srv) {
          return undefined;
        }
        const ports = srv.ports;
        // Hardcoded
        for (let i = 0; i < ports.length; ++i) {
          const r = ports[i].split(":");
          if (r.length !== 2) {
            throw new Error();
          }

          if (r[1] === "8545") {
            const port = Number.parseInt(r[0]);
            if (Number.isNaN(port) || !Number.isFinite(port)) {
              throw new Error();
            }

            this._validatorHttpPort = port;
            continue;
          }

          if (r[1] === "8546") {
            const port = Number.parseInt(r[0]);
            if (Number.isNaN(port) || !Number.isFinite(port)) {
              throw new Error();
            }
            this._validatorWsPort = port;
            continue;
          }
        }
        if (this._validatorHttpPort === undefined || this._validatorWsPort === undefined) {
          this._validatorHttpPort = undefined;
          this._validatorWsPort = undefined;
          return undefined;
        }
        return { http: this._validatorHttpPort, ws: this._validatorWsPort };
      }
    } catch {
      throw new HardhatFhevmError(`Unable to parse Fhevm Validator service ports in Docker compose file.`);
    }
  }

  parseValidatorContainerName(): string | undefined {
    const validatorServiceName = ServiceNames.validator;
    const validatorServiceIndex = 1;
    const json = this.dockerComposeJson();
    if (!json) {
      return undefined;
    }
    return `${json.name}-${validatorServiceName}-${validatorServiceIndex}`;
  }
}
