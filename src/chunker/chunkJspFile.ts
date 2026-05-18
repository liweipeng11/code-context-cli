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
  if (hasPattern(content, /<%@\s*(page|taglib|include)\b/i)) {
    return "jsp-directive";
  }
  if (hasPattern(content, /<jsp:include\b/i) || hasPattern(content, /<%@\s*include\b/i)) {
    return "jsp-include";
  }
  if (hasPattern(content, /<(?:html:)?form\b/i)) {
    return "jsp-form";
  }
  if (hasPattern(content, /<script\b/i)) {
    return "jsp-script";
  }
  if (hasPattern(content, /<%(?!@)[\s\S]*?%>/)) {
    return "jsp-scriptlet";
  }
  if (hasPattern(content, /\$\{[^}]+\}/)) {
    return "jsp-template";
  }
  return "jsp-text";
}

export function chunkJspFile(filePath: string, content: string, config: CtxConfig): CodeChunk[] {
  var base = chunkTextFile(filePath, content, config, "jsp-text", undefined);
  var chunks: CodeChunk[] = [];
  for (var i = 0; i < base.length; i++) {
    var chunk = base[i];
    var extraKeywords = collect(chunk.content, /\$\{([^}]+)\}/g)
      .concat(collect(chunk.content, /name=["']([^"']+)["']/gi))
      .concat(collect(chunk.content, /id=["']([^"']+)["']/gi))
      .concat(collect(chunk.content, /<%@\s*(page|taglib|include)\b/gi));
    var links = collect(chunk.content, /<jsp:include[^>]+page=["']([^"']+)["']/gi)
      .concat(collect(chunk.content, /<%@\s*include[^%]+file=["']([^"']+)["']/gi))
      .concat(collect(chunk.content, /<iframe[^>]+src=["']([^"']+)["']/gi))
      .concat(collect(chunk.content, /showModalDialog\s*\(\s*["']([^"']+)["']/gi))
      .concat(collect(chunk.content, /<(?:html:)?form[^>]+action=["']([^"']+)["']/gi))
      .concat(collect(chunk.content, /<script[^>]+src=["']([^"']+)["']/gi));

    chunks.push(createChunk(
      filePath,
      i,
      jspType(chunk.content),
      undefined,
      chunk.startLine,
      chunk.endLine,
      chunk.content,
      extraKeywords,
      links,
      extraKeywords
    ));
  }
  return chunks;
}
