import fs = require("fs");
import { getCtxDir } from "../utils/pathUtils";
import { removeDirRecursive } from "../store/indexStore";
import { info } from "../utils/logger";

export function runClean(rootDir: string): void {
  var dir = getCtxDir(rootDir);
  if (!fs.existsSync(dir)) {
    info(".ctx does not exist.");
    return;
  }
  // 只删除 .ctx 目录，不碰 .ctxrc.json，因为配置通常需要保留。
  removeDirRecursive(dir);
  info("Removed .ctx");
}
