import path = require("path");
import { CtxConfig } from "../config/defaultConfig";
import { CodeChunk } from "../store/types";
import { chunkTextFile, extractCommonKeywords } from "./chunkTextFile";
import { chunkJspFile } from "./chunkJspFile";
import { chunkJavaFile } from "./chunkJavaFile";
import { chunkXmlFile } from "./chunkXmlFile";
import { chunkVueFile } from "./chunkVueFile";

export function languageFromPath(filePath: string): string {
  // 语言字段只做轻量推断，主要用于 Markdown 代码块高亮。
  var ext = path.extname(filePath).toLowerCase();
  if (ext.length > 0) {
    return ext.slice(1);
  }
  return "text";
}

export function makeChunkId(filePath: string, index: number): string {
  // 第一版索引存在 JSON 文件里，不需要复杂 id；路径 + 序号足够稳定和可读。
  return filePath + "#" + String(index + 1);
}

export function normalizeWords(words: string[]): string[] {
  // 去重时忽略大小写，但保留第一次出现的原始写法，便于调试和阅读索引。
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
  /*
   * 所有切分器最终都走 createChunk：
   * - 统一补 language、id；
   * - 统一做通用关键词提取；
   * - 再合并各语言切分器提供的 extraKeywords/extraLinks。
   */
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
  /*
   * 这里是“按文件类型分发”的入口：
   * JSP/Java/XML/Vue 有一些特殊结构，所以使用专门切分器；
   * 其他文件用固定行数切分。
   */
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
