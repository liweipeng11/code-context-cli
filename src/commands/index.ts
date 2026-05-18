import fs = require("fs");
import { loadConfig } from "../config/loadConfig";
import { scanProject } from "../scanner/scanProject";
import { buildChunks } from "../chunker/buildChunks";
import { saveIndex } from "../store/indexStore";
import { CodeIndex, IndexedFile, CodeChunk } from "../store/types";
import { fileHash } from "../utils/fileHash";
import { info } from "../utils/logger";

export function runIndex(rootDir: string): void {
  var config = loadConfig(rootDir);
  var scanResult = scanProject(rootDir, config);
  var files = scanResult.files;
  var indexedFiles: IndexedFile[] = [];
  var chunks: CodeChunk[] = [];
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var content: string;
    try {
      content = fs.readFileSync(file.absolutePath, "utf8");
    } catch (err) {
      scanResult.skippedFiles.push({
        filePath: file.relativePath,
        size: file.size,
        reason: "Unable to read file as utf8: " + (err instanceof Error ? err.message : String(err))
      });
      continue;
    }
    var fileChunks = buildChunks(file.relativePath, content, config);
    indexedFiles.push({
      filePath: file.relativePath,
      hash: fileHash(content),
      size: file.size,
      chunks: fileChunks.length
    });
    chunks = chunks.concat(fileChunks);
  }
  var index: CodeIndex = {
    version: 1,
    createdAt: new Date().toISOString(),
    rootDir: rootDir,
    files: indexedFiles,
    skippedFiles: scanResult.skippedFiles,
    chunks: chunks
  };
  saveIndex(rootDir, index);
  info("Indexed " + indexedFiles.length + " files and " + chunks.length + " chunks.");
  if (scanResult.skippedFiles.length > 0) {
    info("Skipped " + scanResult.skippedFiles.length + " files because of scan limits.");
  }
  info("Wrote .ctx/index.json");
}
