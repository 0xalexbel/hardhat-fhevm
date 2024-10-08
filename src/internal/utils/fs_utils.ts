import fs from "fs";
import { HardhatFhevmError } from "../../error";

export function writeFileWithBackupSync(src: string, dst: string, backupExt: string) {
  if (backupExt.length === 0) {
    throw new HardhatFhevmError(`Empty file extension`);
  }

  if (!fs.existsSync(src)) {
    throw new HardhatFhevmError(`File ${src} does not exist`);
  }

  if (backupExt.at(0) !== ".") {
    backupExt = "." + backupExt;
  }

  const dst_backup = dst + backupExt;

  if (!fs.existsSync(dst) && !fs.existsSync(dst_backup)) {
    throw new HardhatFhevmError(`Neither file ${dst} nor its corresponding backup file ${dst_backup} exist.`);
  }

  // Keep a copy of the original file
  if (!fs.existsSync(dst_backup)) {
    fs.copyFileSync(dst, dst_backup);
  }

  // replace dst by src
  if (fs.existsSync(dst)) {
    fs.rmSync(dst);
  }

  fs.copyFileSync(src, dst);
}

export function restoreBackupFileSync(file: string, backupExt: string, keepBackupFile: boolean) {
  if (backupExt.length === 0) {
    throw new HardhatFhevmError(`Empty file extension`);
  }

  if (backupExt.at(0) !== ".") {
    backupExt = "." + backupExt;
  }

  const file_backup = file + backupExt;

  if (fs.existsSync(file_backup)) {
    // rm existing file
    if (fs.existsSync(file)) {
      fs.rmSync(file);
    }

    // restore the backup
    fs.copyFileSync(file_backup, file);

    // rm backup if requested
    if (!keepBackupFile) {
      fs.rmSync(file_backup);
    }
  }
}
