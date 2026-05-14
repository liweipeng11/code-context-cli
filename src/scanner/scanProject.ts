import fs = require("fs");
import path = require("path");
import fastGlob = require("fast-glob");
import { CtxConfig } from "../config/defaultConfig";
import { toRelativeDisplayPath } from "../utils/pathUtils";

export interface ScannedFile {
  /** 文件绝对路径，用于真正读取文件内容。 */
  absolutePath: string;
  /** 展示和写入索引用的相对路径，统一使用 /。 */
  relativePath: string;
  /** 文件大小，超过 maxFileSizeKB 的文件会被跳过。 */
  size: number;
}

export function scanProject(rootDir: string, config: CtxConfig): ScannedFile[] {
  /*
   * fast-glob 负责跨平台扫描文件。这里传 cwd=rootDir，
   * 得到的是相对 rootDir 的路径，后续再用 path.join 转成绝对路径。
   *
   * 注意：ignore 使用配置里的 exclude，避免扫描 node_modules、dist、.git 等目录。
   */
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
      // 大文件通常不适合直接进入 LLM 上下文，第一版选择跳过。
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
