import { readAroundLine } from "../tools/readAroundLine";
import { printFileSlice } from "./slice";
import { info } from "../utils/logger";

export function runAround(
  rootDir: string,
  filePath: string,
  line: number,
  before: number,
  after: number,
  json: boolean
): void {
  var slice = readAroundLine(rootDir, filePath, line, before, after);
  if (json) {
    info(JSON.stringify(slice, null, 2));
    return;
  }
  printFileSlice(slice);
}
