import path = require("path");
import { CtxConfig } from "../config/defaultConfig";
import { CodeChunk } from "../store/types";
import { chunkTextFile, extractCommonKeywords } from "./chunkTextFile";
import { chunkJspFile } from "./chunkJspFile";
import { chunkJavaFile } from "./chunkJavaFile";
import { chunkXmlFile } from "./chunkXmlFile";
import { chunkVueFile } from "./chunkVueFile";

export function languageFromPath(filePath: string): string {
  var ext = path.extname(filePath).toLowerCase();
  if (ext.length > 0) {
    return ext.slice(1);
  }
  return "text";
}

export function makeChunkId(filePath: string, index: number): string {
  return filePath + "#" + String(index + 1);
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
  extraLinks: string[]
): CodeChunk {
  var common = extractCommonKeywords(content);
  return {
    id: makeChunkId(filePath, index),
    filePath: filePath,
    language: languageFromPath(filePath),
    type: type,
    name: name,
    startLine: startLine,
    endLine: endLine,
    content: content,
    keywords: normalizeWords(common.keywords.concat(extraKeywords)),
    links: normalizeWords(common.links.concat(extraLinks))
  };
}

export function buildChunks(filePath: string, content: string, config: CtxConfig): CodeChunk[] {
  var ext = path.extname(filePath).toLowerCase();
  if (ext === ".jsp") {
    return chunkJspFile(filePath, content, config);
  }
  if (ext === ".java") {
    return chunkJavaFile(filePath, content, config);
  }
  if (ext === ".xml") {
    return chunkXmlFile(filePath, content, config);
  }
  if (ext === ".vue") {
    return chunkVueFile(filePath, content, config);
  }
  return chunkTextFile(filePath, content, config, "text", undefined);
}
