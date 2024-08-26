import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getPackageDir } from "./dirs";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import yaml from "yaml";
import dotenv from "dotenv";
import { HardhatFhevmError } from "./error";
import { runCmd } from "../run";
import assert from "assert";
import { computeContractAddress } from "./contracts";
import { applyTemplate, removePrefix } from "./utils";
import { rimrafSync } from "rimraf";

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

export class DockerServices {
  private hre: HardhatRuntimeEnvironment;
  public readonly packageDockerDir: string;
  public readonly packageDockerFile: string;
  public readonly installDockerDir: string;
  public readonly installDockerFile: string;
  private _dockerComposeJson: DockerComposeJson | undefined;
  private _gatewayServiceEnvs: Record<string, string> | undefined;
  private _validatorServiceEnvs: Record<string, string> | undefined;

  constructor(hre: HardhatRuntimeEnvironment) {
    this.hre = hre;

    const dir = getPackageDir();
    this.packageDockerDir = path.join(dir, "docker");
    this.packageDockerFile = path.join(this.packageDockerDir, "docker-compose-full.yml");

    this.installDockerDir = path.normalize(path.join(hre.config.paths.fhevm, "docker"));
    this.installDockerFile = path.join(this.installDockerDir, "docker-compose-full.yml");
  }

  dockerComposeJson(): DockerComposeJson {
    if (!this._dockerComposeJson) {
      const file = fs.readFileSync(this.packageDockerFile, "utf8");
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

  validatorContainerName() {
    const validatorServiceName = ServiceNames.validator;
    const validatorServiceIndex = 1;
    const json = this.dockerComposeJson();
    return `${json.name}-${validatorServiceName}-${validatorServiceIndex}`;
  }

  async isFhevmRunning(): Promise<boolean> {
    const stdout = await runCmd(`docker compose -f ${this.installDockerFile} ls`);
    return stdout.indexOf("running(6)") > 0;
  }

  async isDockerRunning(): Promise<boolean> {
    try {
      await runCmd("docker info");
      return true;
    } catch {
      return false;
    }
  }

  async installFiles() {
    try {
      const src = this.hre.fhevm.dockerServices().packageDockerDir;
      const dst = this.hre.fhevm.dockerServices().installDockerDir;

      await fsPromises.cp(src, dst, { recursive: true, dereference: true });

      const TFHEExecutorAddress = computeContractAddress("TFHEExecutor", undefined, this.hre);
      const gatewayContractAddress = computeContractAddress("GatewayContract", undefined, this.hre);

      const values: [string, string][] = [
        ["GatewayRelayerPrivateKey", this.hre.config.networks.fhevm.accounts.GatewayRelayerPrivateKey],
        ["GatewayContractAddress", removePrefix(gatewayContractAddress, "0x")],
        //["GatewayKmsKeyID", hre.config.networks.fhevm.accounts.GatewayKmsKeyID],
        ["TFHEExecutorAddress", TFHEExecutorAddress],
        //["EXT_TFHE_LIBRARY", EXT_TFHE_LIBRARY],
      ];

      const templatePath = path.join(dst, "docker-compose-full-template.yml");
      const templateContent = fs.readFileSync(templatePath, "utf8");

      const finalContent = applyTemplate(templateContent, values);
      const finalPath = path.join(dst, "docker-compose-full.yml");

      fs.writeFileSync(finalPath, finalContent, { encoding: "utf8", flag: "w" });

      rimrafSync(templatePath);
    } catch (err) {
      throw new HardhatFhevmError(`Unable to install docker files ${err}`);
    }
  }
}
