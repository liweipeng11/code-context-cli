import fs = require("fs");
import path = require("path");
import fastGlob = require("fast-glob");
import { CtxConfig } from "../config/defaultConfig";
import { toRelativeDisplayPath } from "../utils/pathUtils";

export interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  size: number;
}

export function scanProject(rootDir: string, config: CtxConfig): ScannedFile[] {
  var entries = fastGlob.sync(config.include, {
    cwd: rootDir,
    ignore: config.exclude,
    onlyFiles: true,
    dot: false,
    unique: true,
    followSymbolicLinks: false
  });
  var result: ScannedFile[] = [];
  var maxBytes = config.maxFileSizeKB * 1024;
  for (var i = 0; i < entries.length; i++) {
    var absolutePath = path.join(rootDir, entries[i]);
    var stat = fs.statSync(absolutePath);
    if (stat.size > maxBytes) {
      continue;
    }
    result.push({
      absolutePath: absolutePath,
      relativePath: toRelativeDisplayPath(rootDir, absolutePath),
      size: stat.size
    });
  }
  return result;
}
