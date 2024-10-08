import type childProcess from "child_process";
import { exec as execCallback } from "child_process";
import { promisify } from "util";
import spawn from "cross-spawn";
import { HardhatFhevmError } from "../../error";
import path from "path";

const exec = promisify(execCallback);

export interface RunDockerOptions {
  cwd?: string;
  env?: Record<string, string>;
  quiet?: boolean;
}

export function runDocker(args: string[], options?: RunDockerOptions): childProcess.SpawnSyncReturns<Buffer> {
  const docker = "docker";
  const stdio: childProcess.StdioOptions = options?.quiet === true ? "ignore" : "inherit";
  return runScriptSync(docker, args, {
    cwd: options?.cwd ?? process.cwd(),
    stdio,
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
//   } catch (error) {
//     throw new HardhatFhevmError(`Unexpected error while running ${cmd}: ${error}`);
//   }
// }

export async function runCmd(cmd: string, timeout?: number | undefined): Promise<string> {
  try {
    const { stdout } = await exec(cmd, { timeout: timeout });
    return stdout;
  } catch (error) {
    throw new HardhatFhevmError(`Unexpected error while running ${cmd}: ${error}`);
  }
}
