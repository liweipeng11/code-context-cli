import fs = require("fs");
import path = require("path");
import { CodeIndex } from "./types";
import { getCtxDir, getIndexPath } from "../utils/pathUtils";

export function ensureCtxDir(rootDir: string): void {
  var dir = getCtxDir(rootDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function saveIndex(rootDir: string, index: CodeIndex): void {
  ensureCtxDir(rootDir);
  fs.writeFileSync(getIndexPath(rootDir), JSON.stringify(index, null, 2), "utf8");
}

export function loadIndex(rootDir: string): CodeIndex {
  var indexPath = getIndexPath(rootDir);
  if (!fs.existsSync(indexPath)) {
    throw new Error("Index not found at " + indexPath + ". Run ctx index . first.");
  }
  return JSON.parse(fs.readFileSync(indexPath, "utf8")) as CodeIndex;
}

export function removeDirRecursive(dir: string): void {
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
