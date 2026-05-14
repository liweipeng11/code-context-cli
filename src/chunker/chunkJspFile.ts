import { CtxConfig } from "../config/defaultConfig";
import { CodeChunk } from "../store/types";
import { createChunk } from "./buildChunks";
import { chunkTextFile } from "./chunkTextFile";

function hasPattern(content: string, regex: RegExp): boolean {
  return regex.test(content);
}

function collect(content: string, regex: RegExp): string[] {
  var result: string[] = [];
  var match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    result.push(match[1] || match[0]);
  }
  return result;
}

function jspType(content: string): string {
  if (hasPattern(content, /<form\b/i)) {
    return "jsp-form";
  }
  if (hasPattern(content, /<jsp:include\b/i)) {
    return "jsp-include";
  }
  if (hasPattern(content, /showModalDialog\s*\(/i)) {
    return "jsp-modal";
  }
  if (hasPattern(content, /<iframe\b/i)) {
    return "jsp-iframe";
  }
  if (hasPattern(content, /<%[\s\S]*?%>/)) {
    return "jsp-scriptlet";
  }
  if (hasPattern(content, /\$\{[^}]+\}/)) {
    return "jsp-el";
  }
  return "jsp";
}

export function chunkJspFile(filePath: string, content: string, config: CtxConfig): CodeChunk[] {
  var base = chunkTextFile(filePath, content, config, "jsp", undefined);
  var chunks: CodeChunk[] = [];
  for (var i = 0; i < base.length; i++) {
    var chunk = base[i];
    var extraKeywords = collect(chunk.content, /\$\{([^}]+)\}/g)
      .concat(collect(chunk.content, /name=["']([^"']+)["']/gi))
      .concat(collect(chunk.content, /id=["']([^"']+)["']/gi));
    var links = collect(chunk.content, /<jsp:include[^>]+page=["']([^"']+)["']/gi)
      .concat(collect(chunk.content, /<iframe[^>]+src=["']([^"']+)["']/gi))
      .concat(collect(chunk.content, /showModalDialog\s*\(\s*["']([^"']+)["']/gi))
      .concat(collect(chunk.content, /<form[^>]+action=["']([^"']+)["']/gi));
    chunks.push(createChunk(filePath, i, jspType(chunk.content), undefined, chunk.startLine, chunk.endLine, chunk.content, extraKeywords, links));
  }
  return chunks;
}
