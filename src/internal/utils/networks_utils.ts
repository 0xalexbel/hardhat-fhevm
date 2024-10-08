import assert from "assert";
import { HARDHAT_NETWORK_NAME } from "hardhat/plugins";
import { HardhatConfig } from "hardhat/types";

export function getNetworkURL(networkName: string, config: HardhatConfig): URL | undefined {
  const network = config.networks[networkName];
  if (network === undefined) {
    return undefined;
  }
  if ("url" in network) {
    try {
      const url = new URL(network.url);
      return url;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
function urlIsLocalhost(url: URL | string, strict?: boolean): boolean {
  let u: URL;
  if (typeof url === "string") {
    u = new URL(url);
  } else {
    u = url;
  }

  if (strict) {
    return u.hostname === "localhost";
  } else {
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  }
}

/**
 * network[name] === networks.localhost IAOI:
 * - name === 'localhost'
 * - same host ("localhost" or "127.0.0.1")
 * - same port
 * - same protocol
 * - same chainid
 */
export function networkEqHHLocalhost(name: string, config: HardhatConfig) {
  if (name !== "localhost") {
    return false;
  }
  const url = getNetworkURL(name, config);
  if (!url) {
    return false;
  }
  const lhn = config.networks.localhost;
  const lhUrl = new URL(lhn.url);
  if (lhUrl.port !== url.port) {
    return false;
  }
  if (lhUrl.protocol !== url.protocol) {
    return false;
  }
  assert(lhUrl.hostname === "127.0.0.1" || lhUrl.hostname === "localhost");
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    return false;
  }
  if (config.networks[name].chainId === config.networks[HARDHAT_NETWORK_NAME].chainId) {
    return true;
  }
  return false;
}
