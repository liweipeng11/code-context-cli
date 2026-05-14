import fs = require("fs");
import { defaultConfig } from "../config/defaultConfig";
import { getConfigPath } from "../utils/pathUtils";
import { info } from "../utils/logger";

export function runInit(rootDir: string): void {
  var configPath = getConfigPath(rootDir);
  if (fs.existsSync(configPath)) {
    // 不覆盖已有配置，避免用户手动调整过 include/exclude 后被重置。
    info(".ctxrc.json already exists.");
    return;
  }
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf8");
  info("Created .ctxrc.json");
}
