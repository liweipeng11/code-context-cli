import fs = require("fs");
import path = require("path");
import fastGlob = require("fast-glob");
import { CtxConfig } from "../config/defaultConfig";
import { toRelativeDisplayPath } from "../utils/pathUtils";
import { SkippedFile } from "../store/types";

export interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  size: number;
}

export interface ScanProjectResult {
  files: ScannedFile[];
  skippedFiles: SkippedFile[];
}

export function scanProject(rootDir: string, config: CtxConfig): ScanProjectResult {
  var entries = fastGlob.sync(config.include, {
    cwd: rootDir,
    ignore: config.exclude,
    onlyFiles: true,
    dot: false,
    unique: true,
    followSymbolicLinks: false
  });
  entries.sort();

  var files: ScannedFile[] = [];
  var skippedFiles: SkippedFile[] = [];
  var maxBytes = config.maxFileSizeKB * 1024;
  for (var i = 0; i < entries.length; i++) {
    var absolutePath = path.join(rootDir, entries[i]);
    var relativePath = toRelativeDisplayPath(rootDir, absolutePath);
    var stat = fs.statSync(absolutePath);
    if (stat.size > maxBytes) {
      skippedFiles.push({
        filePath: relativePath,
        size: stat.size,
        reason: "File is larger than maxFileSizeKB (" + config.maxFileSizeKB + "KB)"
      });
      continue;
    }
    files.push({
      absolutePath: absolutePath,
      relativePath: relativePath,
      size: stat.size
    });
  }
  return {
    files: files,
    skippedFiles: skippedFiles
  };
}
