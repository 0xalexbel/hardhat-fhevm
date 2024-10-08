import fs from "fs";
import { HardhatFhevmError } from "../../error";
import { throwIfFileDoesNotExist } from "./dirs";
import { ethers as EthersT } from "ethers";
import { replaceStrings } from "./string_utils";

function _extractAddressBetween(content: string, prefix: string, suffix: string) {
  const prefix_index = content.indexOf(prefix);
  const suffix_index = content.indexOf(suffix, prefix_index + prefix.length);

  if (prefix_index < 0 || suffix_index !== prefix_index + 40 + prefix.length) {
    throw new HardhatFhevmError(`Unable to locate address`);
  }

  const address = content.substring(prefix_index + prefix.length - 2, suffix_index);
  return {
    address,
    normalizedAddress: EthersT.getAddress(address),
  };
}

/**
 * returns `true` if file has changed
 */
export function replaceAddressesInFileSync(
  path: string,
  contractAddresses: Array<{ address: string; prefix: string; suffix: string }>,
): boolean {
  throwIfFileDoesNotExist(path);

  try {
    const content = fs.readFileSync(path, "utf8");
    let changed = false;
    const addressesToReplace: [string, string][] = contractAddresses.map((v) => {
      const addr = _extractAddressBetween(content, v.prefix, v.suffix);
      changed = changed || addr.address.toLowerCase() !== v.address.toLowerCase();
      return [addr.address, v.address];
    });

    if (!changed) {
      return false;
    }

    const new_content = replaceStrings(content, addressesToReplace);

    fs.writeFileSync(path, new_content, { encoding: "utf8", flag: "w" });

    return true;
  } catch (error) {
    throw new HardhatFhevmError(`Write ${path} failed. ${error}`);
  }
}

export function bigIntToAddress(value: bigint): string {
  return "0x" + value.toString(16).padStart(40, "0");
}
