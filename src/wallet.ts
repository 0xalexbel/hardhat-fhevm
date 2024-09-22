import { ethers as EthersT } from "ethers";
import { HardhatFhevmError } from "./error";

export function walletFromMnemonic(
  index: number,
  phrase: string,
  path: string,
  provider: EthersT.Provider | null,
): EthersT.HDNodeWallet {
  const mnemonic = EthersT.Mnemonic.fromPhrase(phrase);
  if (!mnemonic) {
    throw new HardhatFhevmError(`Invalid mnemonic phrase: ${phrase}`);
  }
  const rootWallet = EthersT.HDNodeWallet.fromMnemonic(mnemonic, path);
  return rootWallet.deriveChild(index).connect(provider);
}
