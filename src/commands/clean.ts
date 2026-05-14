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
  removeDirRecursive(dir);
  info("Removed .ctx");
}
