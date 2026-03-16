import fs from "node:fs";
import path from "node:path";

export function resolveAppRootDir() {
  const envRoot = process.env.BOT_ROOT_DIR;
  if (envRoot) return path.resolve(envRoot);

  const cwd = process.cwd();
  const cwdConfig = path.join(cwd, "config.json");
  if (fs.existsSync(cwdConfig)) return cwd;

  const exeDir = path.dirname(process.execPath || "");
  if (exeDir) {
    const exeConfig = path.join(exeDir, "config.json");
    if (fs.existsSync(exeConfig)) return exeDir;
  }

  return cwd;
}

