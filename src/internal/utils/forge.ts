import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec as execCallback } from "child_process";
import { HardhatFhevmError } from "../../error";
const exec = promisify(execCallback);

export async function isForgeInstalled() {
  const cmd = `forge --version`;

  try {
    await exec(cmd);
    return true;
  } catch {
    return false;
  }
}

export function writeFoundryToml(
  tomlPath: string,
  forgeStdVersion: string,
  solidityVersion: string,
  remappings: Record<string, string>,
) {
  const rm = Object.entries(remappings).map(([k, v]) => `"${k}=${v}"`);
  let s = "";
  for (let i = 0; i < rm.length; ++i) {
    s += "    " + rm[i];
    if (i !== rm.length - 1) {
      s += ",\n";
    }
  }

  const content = `# Full reference https://github.com/foundry-rs/foundry/tree/master/crates/config
  
[profile.default]
script = "script"
solc = "${solidityVersion}"
evm_version = 'cancun'
src = 'contracts'
test = 'test_forge'
libs = ["node_modules", "dependencies"]
cache_path = 'cache_forge'
out = 'artifacts_forge'
remappings = [
  "forge-std=dependencies/forge-std-${forgeStdVersion}/src",
  ${s}
]
  
[dependencies]
forge-std = "${forgeStdVersion}"

`;

  fs.writeFileSync(tomlPath, content, { encoding: "utf8", flag: "w" });
}

export async function installForgeStdUsingSoldeer(tomlPath: string) {
  const dir = path.dirname(tomlPath);
  const cmd = `cd ${dir} ; forge soldeer install`;

  try {
    await exec(cmd);
  } catch {
    throw new HardhatFhevmError(`Failed to install forge dependencies`);
  }
}

export async function forgeScript(scriptPath: string) {
  console.log("scriptPath = " + scriptPath);
  if (fs.existsSync("./foundry.toml")) {
    console.log("./foundry.toml = true");
    const a = await exec(`cat ./foundry.toml`);
    console.log(a.stdout);
    console.log(a.stderr);
  } else {
    console.log("./foundry.toml = false");
  }
  //forge script ./test_forge/TestEncryptedERC20.s.sol
  await exec(`forge script ${scriptPath}`);
}
