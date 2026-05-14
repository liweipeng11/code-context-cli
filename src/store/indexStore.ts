import fs = require("fs");
import path = require("path");
import { CodeIndex } from "./types";
import { getCtxDir, getIndexPath } from "../utils/pathUtils";

export function ensureCtxDir(rootDir: string): void {
  // 所有运行产物都放在 .ctx 目录，便于 clean 和 .gitignore 管理。
  var dir = getCtxDir(rootDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function saveIndex(rootDir: string, index: CodeIndex): void {
  ensureCtxDir(rootDir);
  // 第一版使用漂亮格式 JSON，方便用户打开查看和调试。
  fs.writeFileSync(getIndexPath(rootDir), JSON.stringify(index, null, 2), "utf8");
}

export function loadIndex(rootDir: string): CodeIndex {
  var indexPath = getIndexPath(rootDir);
  if (!fs.existsSync(indexPath)) {
    // search/context 都依赖 index.json，所以这里给出明确下一步提示。
    throw new Error("Index not found at " + indexPath + ". Run ctx index . first.");
  }
  return JSON.parse(fs.readFileSync(indexPath, "utf8")) as CodeIndex;
}

export function removeDirRecursive(dir: string): void {
  /*
   * 为了兼容 Node 12 和 Windows 7，这里不用 fs.rmSync。
   * fs.rmSync 是较新的 API；递归 unlink/rmdir 更稳妥。
   */
  if (!fs.existsSync(dir)) {
    return;
  }
  var entries = fs.readdirSync(dir);
  for (var i = 0; i < entries.length; i++) {
    var full = path.join(dir, entries[i]);
    var stat = fs.lstatSync(full);
    if (stat.isDirectory()) {
      removeDirRecursive(full);
    } else {
      fs.unlinkSync(full);
    }
  }
  fs.rmdirSync(dir);
}
