import { getChunkById } from "../tools/getChunk";
import { CodeChunk } from "../store/types";
import { info } from "../utils/logger";

function printChunk(chunk: CodeChunk): void {
  info("Chunk: " + chunk.id);
  info("File: " + chunk.filePath);
  info("Lines: " + chunk.startLine + "-" + chunk.endLine);
  if (chunk.name) {
    info("Name: " + chunk.name);
  }
  info("");
  info("```" + chunk.language);
  info(chunk.content);
  info("```");
}

export function runChunkGet(rootDir: string, chunkId: string, json: boolean): void {
  var chunk = getChunkById(rootDir, chunkId);
  if (json) {
    info(JSON.stringify(chunk, null, 2));
    return;
  }
  printChunk(chunk);
}
