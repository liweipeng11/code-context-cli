import fs = require("fs");
import path = require("path");
import { FileSlice } from "../store/types";
import { toDisplayPath } from "../utils/pathUtils";

export var MAX_SLICE_LINES = 300;

function resolveInsideRoot(rootDir: string, filePath: string): string {
  var root = path.resolve(rootDir);
  var full = path.resolve(root, filePath);
  var relative = path.relative(root, full);
  if (relative === "" || relative.indexOf("..") === 0 || path.isAbsolute(relative)) {
    throw new Error("File path escapes project root: " + filePath);
  }
  return full;
}

function normalizeDisplayPath(rootDir: string, absolutePath: string): string {
  return toDisplayPath(path.relative(path.resolve(rootDir), absolutePath));
}

export function readFileSlice(
  rootDir: string,
  filePath: string,
  startLine: number,
  endLine: number
): FileSlice {
  if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) {
    throw new Error("startLine and endLine must be valid numbers.");
  }

  var absolutePath = resolveInsideRoot(rootDir, filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error("File not found: " + filePath);
  }
  var stat = fs.statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error("Path is not a file: " + filePath);
  }

  var content = fs.readFileSync(absolutePath, "utf8");
  var lines = content.split(/\r?\n/);
  var totalLines = lines.length;
  var normalizedStart = Math.max(1, Math.floor(startLine));
  var normalizedEnd = Math.min(totalLines, Math.floor(endLine));

  if (normalizedStart > normalizedEnd) {
    throw new Error("startLine must be less than or equal to endLine after clipping.");
  }
  if (normalizedEnd - normalizedStart + 1 > MAX_SLICE_LINES) {
    throw new Error("Requested range is too large. Maximum is " + MAX_SLICE_LINES + " lines.");
  }

  return {
    filePath: normalizeDisplayPath(rootDir, absolutePath),
    startLine: normalizedStart,
    endLine: normalizedEnd,
    totalLines: totalLines,
    content: lines.slice(normalizedStart - 1, normalizedEnd).join("\n")
  };
}
