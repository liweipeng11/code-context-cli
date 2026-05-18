import path = require("path");
import { CtxConfig } from "../config/defaultConfig";
import { CodeChunk } from "../store/types";
import { chunkTextFile, extractCommonKeywords } from "./chunkTextFile";
import { chunkJspFile } from "./chunkJspFile";
import { chunkJavaFile } from "./chunkJavaFile";
import { chunkXmlFile } from "./chunkXmlFile";
import { chunkVueFile } from "./chunkVueFile";
import { fileHash } from "../utils/fileHash";
import { toDisplayPath } from "../utils/pathUtils";

export function languageFromPath(filePath: string): string {
  var ext = path.extname(filePath).toLowerCase();
  if (ext === ".tsx") {
    return "ts";
  }
  if (ext === ".jsx") {
    return "js";
  }
  if (ext.length > 0) {
    return ext.slice(1);
  }
  return "text";
}

export function makeChunkId(filePath: string, startLine: number, endLine: number): string {
  return filePath + "#" + startLine + "-" + endLine;
}

export function normalizeWords(words: string[]): string[] {
  var map: { [key: string]: boolean } = {};
  var result: string[] = [];
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if (!word) {
      continue;
    }
    var normalized = word.toLowerCase();
    if (!map[normalized]) {
      map[normalized] = true;
      result.push(word);
    }
  }
  return result;
}

export function createChunk(
  filePath: string,
  index: number,
  type: string,
  name: string | undefined,
  startLine: number,
  endLine: number,
  content: string,
  extraKeywords: string[],
  extraLinks: string[],
  extraSymbols?: string[]
): CodeChunk {
  var common = extractCommonKeywords(content);
  return {
    id: makeChunkId(filePath, startLine, endLine),
    filePath: filePath,
    fileHash: "",
    language: languageFromPath(filePath),
    type: type,
    name: name,
    startLine: startLine,
    endLine: endLine,
    content: content,
    keywords: normalizeWords(common.keywords.concat(extraKeywords)),
    links: normalizeWords(common.links.concat(extraLinks)),
    symbols: normalizeWords((extraSymbols || []).concat(name ? [name] : []))
  };
}

export function buildChunks(filePath: string, content: string, config: CtxConfig): CodeChunk[] {
  var normalizedPath = toDisplayPath(filePath);
  if (content.length === 0) {
    return [];
  }
  var ext = path.extname(filePath).toLowerCase();
  var chunks: CodeChunk[];
  if (ext === ".jsp") {
    chunks = chunkJspFile(normalizedPath, content, config);
  } else if (ext === ".java") {
    chunks = chunkJavaFile(normalizedPath, content, config);
  } else if (ext === ".xml") {
    chunks = chunkXmlFile(normalizedPath, content, config);
  } else if (ext === ".vue") {
    chunks = chunkVueFile(normalizedPath, content, config);
  } else {
    chunks = chunkTextFile(normalizedPath, content, config, "text", undefined);
  }
  var hash = fileHash(content);
  for (var i = 0; i < chunks.length; i++) {
    chunks[i].filePath = normalizedPath;
    chunks[i].fileHash = hash;
    chunks[i].language = languageFromPath(normalizedPath);
    chunks[i].id = makeChunkId(normalizedPath, chunks[i].startLine, chunks[i].endLine);
    chunks[i].keywords = normalizeWords(chunks[i].keywords || []);
    chunks[i].links = normalizeWords(chunks[i].links || []);
    chunks[i].symbols = normalizeWords(chunks[i].symbols || []);
  }
  return chunks;
}
