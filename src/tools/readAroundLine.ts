import { FileSlice } from "../store/types";
import { readFileSlice } from "./readSlice";

export function readAroundLine(
  rootDir: string,
  filePath: string,
  line: number,
  before: number,
  after: number
): FileSlice {
  if (!Number.isFinite(line) || !Number.isFinite(before) || !Number.isFinite(after)) {
    throw new Error("line, before and after must be valid numbers.");
  }
  var targetLine = Math.floor(line);
  var beforeLines = Math.max(0, Math.floor(before));
  var afterLines = Math.max(0, Math.floor(after));
  return readFileSlice(rootDir, filePath, targetLine - beforeLines, targetLine + afterLines);
}
