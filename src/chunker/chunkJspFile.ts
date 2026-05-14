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
  // 根据 chunk 内容粗略标记 JSP 片段类型，帮助 search/context 输出更可读。
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
  /*
   * JSP 文件仍然先按固定行数切分，然后对每个 chunk 做 JSP 特有信息提取。
   * 第一版不做 AST/HTML DOM 解析，原因是要轻量、兼容 Win7、避免引入复杂依赖。
   */
  var base = chunkTextFile(filePath, content, config, "jsp", undefined);
  var chunks: CodeChunk[] = [];
  for (var i = 0; i < base.length; i++) {
    var chunk = base[i];
    // JSP 里的 EL、表单字段、include、iframe、弹窗 URL 都可能指向业务关联。
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
