import { ethers as EthersT } from "ethers";
import { HardhatNetworkAccountsConfig, HttpNetworkAccountsConfig } from "hardhat/types";
import { walletFromMnemonic } from "./wallet";
import { FhevmContractName, FhevmContractsConfig } from "../types";

export function getUserAddresses(accounts: HardhatNetworkAccountsConfig | HttpNetworkAccountsConfig) {
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

export function listFhevmContractsInDeployOrder(
  mock: boolean,
  config: FhevmContractsConfig,
  deployer: string | undefined,
): FhevmContractName[] {
  const contractNames = Object.keys(config.contracts) as FhevmContractName[];

  const filter_fhevm =
    deployer === undefined || deployer === "fhevm"
      ? contractNames.filter((v) => {
          return (mock || config.contracts[v].mock !== true) && config.contracts[v].deployer === "fhevm";
        })
      : [];
  const contractNames_fhevm = filter_fhevm.sort((a, b) => config.contracts[a].nonce - config.contracts[b].nonce);

  const filter_gateway =
    deployer === undefined || deployer === "gateway"
      ? contractNames.filter((v) => {
          return (mock || config.contracts[v].mock !== true) && config.contracts[v].deployer === "gateway";
        })
      : [];
  const contractNames_gateway = filter_gateway.sort((a, b) => config.contracts[a].nonce - config.contracts[b].nonce);

  return contractNames_fhevm.concat(contractNames_gateway);
}
