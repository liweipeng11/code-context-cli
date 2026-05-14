import fs = require("fs");
import { loadConfig } from "../config/loadConfig";
import { scanProject } from "../scanner/scanProject";
import { buildChunks } from "../chunker/buildChunks";
import { saveIndex } from "../store/indexStore";
import { CodeIndex, IndexedFile, CodeChunk } from "../store/types";
import { fileHash } from "../utils/fileHash";
import { info } from "../utils/logger";

export function runIndex(rootDir: string): void {
  /*
   * 建索引的主流程：
   * 1. 读取 .ctxrc.json，没有则使用默认配置；
   * 2. 扫描项目文件；
   * 3. 每个文件按类型切成 chunk；
   * 4. 保存成 .ctx/index.json。
   */
  var config = loadConfig(rootDir);
  var files = scanProject(rootDir, config);
  var indexedFiles: IndexedFile[] = [];
  var chunks: CodeChunk[] = [];
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var content = fs.readFileSync(file.absolutePath, "utf8");
    // buildChunks 会根据扩展名选择 JSP/Java/XML/Vue/普通文本切分器。
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
    version: "0.1.0",
    createdAt: new Date().toISOString(),
    rootDir: rootDir,
    files: indexedFiles,
    chunks: chunks
  };
  saveIndex(rootDir, index);
  info("Indexed " + indexedFiles.length + " files and " + chunks.length + " chunks.");
  info("Wrote .ctx/index.json");
}
