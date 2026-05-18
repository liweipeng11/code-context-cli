import path = require("path");
import { FileSlice } from "../store/types";
import { readFileSlice } from "../tools/readSlice";
import { info } from "../utils/logger";

function languageFromPath(filePath: string): string {
  var ext = path.extname(filePath).replace(".", "");
  return ext || "text";
}

export function printFileSlice(slice: FileSlice): void {
  info("File: " + slice.filePath);
  info("Lines: " + slice.startLine + "-" + slice.endLine);
  info("");
  info("```" + languageFromPath(slice.filePath));
  info(slice.content);
  info("```");
}

export function runSlice(
  rootDir: string,
  filePath: string,
  startLine: number,
  endLine: number,
  json: boolean
): void {
  var slice = readFileSlice(rootDir, filePath, startLine, endLine);
  if (json) {
    info(JSON.stringify(slice, null, 2));
    return;
  }
  printFileSlice(slice);
}
