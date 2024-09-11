import { NomicLabsHardhatPluginError } from "hardhat/plugins";

export class HardhatFhevmError extends NomicLabsHardhatPluginError {
  constructor(message: string, parent?: Error) {
    super("hardhat-fhevm", message, parent);
  }
}

export class HardhatFhevmInternalError extends NomicLabsHardhatPluginError {
  constructor(message: string, parent?: Error) {
    super("hardhat-fhevm-internal", message, parent);
  }
}

export type LogOptions = {
  indent?: string;
  quiet?: boolean;
  stderr?: boolean;
  nocolor?: boolean;
};

type ResolvedLogOptions = {
  indent: string;
  quiet: boolean;
  stderr: boolean;
  nocolor: boolean;
};

export function logBox(msg: string, options: LogOptions) {
  const lo = _resolveLogOptions(options);
  if (lo.quiet) {
    return;
  }
  const left = " ".repeat(1);
  const inner = " ".repeat(2);

  const prefix = "hardhat-fhevm:";
  const n = msg.length + inner.length * 2 + prefix.length + 1;

  if (lo.nocolor === true) {
    msg = `${prefix} ${msg}`;
  } else {
    msg = `\x1b[32m${prefix}\x1b[0m ${msg}`;
  }

  const top = left + "╔" + "═".repeat(n) + "╗\n";
  const middle = left + "║" + inner + msg + inner + "║\n";
  const bottom = left + "╚" + "═".repeat(n) + "╝";

  const box = top + middle + bottom;

  _log("", lo);
  _log(box, lo);
  _log("", lo);
}

function _log(msg: string, options: ResolvedLogOptions) {
  if (options.stderr === true) {
    // use process.sterr.write instead of console.log to escape HH catpure
    // HH colorizes in red all console.error() calls.
    //console.error(msg);
    process.stderr.write(msg + "\n");
  } else {
    // use process.stdout.write instead of console.log to escape HH catpure
    //console.log(`${msg}`);
    process.stdout.write(msg + "\n");
  }
}

function _resolveLogOptions(options: LogOptions): ResolvedLogOptions {
  const o: ResolvedLogOptions = {
    stderr: false,
    nocolor: false,
    indent: "",
    quiet: false,
  };

  if (options.nocolor === true) {
    o.nocolor = true;
  }

  if (options.stderr === true) {
    o.stderr = true;
    //o.nocolor = true;
  } else {
    o.stderr = false;
  }

  o.indent = options.indent ?? "";
  o.quiet = options.quiet === true;

  return o;
}

export function logTrace(msg: string, options: LogOptions) {
  const lo = _resolveLogOptions(options);
  if (lo.quiet) {
    return;
  }
  if (lo.nocolor) {
    _log(`${lo.indent}✔ hardhat-fhevm: ${msg}`, lo);
  } else {
    _log(`${lo.indent}\x1b[32m✔ hardhat-fhevm:\x1b[0m ${msg}`, lo);
  }
}

export function logDim(msg: string, options: LogOptions) {
  const lo = _resolveLogOptions(options);
  if (lo.quiet) {
    return;
  }
  if (lo.nocolor) {
    _log(`${lo.indent}${msg}`, lo);
  } else {
    _log(`${lo.indent}\x1b[2m${msg}\x1b[0m`, lo);
  }
}

export function logDimWithGreenPrefix(prefix: string, msg: string, options: LogOptions) {
  const lo = _resolveLogOptions(options);
  if (lo.quiet) {
    return;
  }
  if (lo.nocolor) {
    _log(`${lo.indent}${prefix}${msg}`, lo);
  } else {
    _log(`${lo.indent}\x1b[32m${prefix}\x1b[0m\x1b[2m${msg}\x1b[0m`, lo);
  }
}
