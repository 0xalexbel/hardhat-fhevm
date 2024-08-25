import type childProcess from "child_process";
import { exec as execCallback } from "child_process";
import { promisify } from "util";
import spawn from "cross-spawn";
import { HardhatFhevmError } from "./common/error";
import path from "path";

const exec = promisify(execCallback);

export interface RunDockerOptions {
  cwd?: string;
  env?: Record<string, string>;
}

export function runDocker(args: string[], options?: RunDockerOptions): childProcess.SpawnSyncReturns<Buffer> {
  const docker = "docker";
  return runScriptSync(docker, args, {
    cwd: options?.cwd ?? process.cwd(),
    stdio: "inherit",
    userAgent: undefined,
    env: { ...options?.env },
  });
}

export function runScriptSync(
  command: string,
  args: string[],
  opts: {
    cwd: string;
    stdio: childProcess.StdioOptions;
    userAgent?: string;
    env: Record<string, string>;
  },
): childProcess.SpawnSyncReturns<Buffer> {
  const env = {
    ...createEnv(opts),
    ...opts.env,
  };
  const result = spawn.sync(command, args, {
    ...opts,
    env,
  });
  if (result.error) throw result.error;
  return result;
}

function createEnv(opts: { cwd: string; userAgent?: string }): NodeJS.ProcessEnv {
  const env = { ...process.env };

  const PATH = getPATH();
  env[PATH] = [path.join(opts.cwd, "node_modules", ".bin"), path.dirname(process.execPath), process.env[PATH]].join(
    path.delimiter,
  );

  if (opts.userAgent) {
    env.npm_config_user_agent = opts.userAgent;
  }

  return env;
}

function getPATH(): string {
  // windows calls it's path 'Path' usually, but this is not guaranteed.
  let PATH: string = "";
  if (process.platform === "win32") {
    PATH = "Path";
    Object.keys(process.env).forEach((e) => {
      if (e.match(/^PATH$/i)) {
        PATH = e;
      }
    });
  } else {
    PATH = "PATH";
  }
  return PATH;
}

// function runCmdSync(cmd: string): string {
//   try {
//     return execSync(cmd, { stdio: "pipe" }).toString();
//   } catch (error: any) {
//     const pluginError = buildFhevmError(error.status, error.stderr.toString());

//     throw pluginError;
//   }
// }

export async function runCmd(cmd: string): Promise<string> {
  try {
    const { stdout } = await exec(cmd);
    return stdout;
  } catch (error) {
    const e = error as { code?: number; message: string };
    throw buildFhevmError(e.code, e.message);
  }
}

function buildFhevmError(exitCode: number | undefined, message: string) {
  switch (exitCode) {
    case 127:
      return new HardhatFhevmError("Couldn't run `forge`. Please check that your foundry installation is correct.");
    case 134:
      return new HardhatFhevmError("Running `forge` failed. Please check that your foundry.toml file is correct.");
    default:
      return new HardhatFhevmError(`Unexpected error while running \`forge\`: ${message}`);
  }
}
