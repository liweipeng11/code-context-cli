import { CtxConfig } from "../config/defaultConfig";
import { CodeChunk } from "../store/types";
import { createChunk, normalizeWords } from "./buildChunks";

export interface KeywordResult {
  keywords: string[];
  links: string[];
}

function collectMatches(content: string, regex: RegExp): string[] {
  // 小工具：把正则中的第一个捕获组收集出来；没有捕获组时使用完整匹配。
  var result: string[] = [];
  var match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    result.push(match[1] || match[0]);
  }
  return result;
}

export function extractCommonKeywords(content: string): KeywordResult {
  /*
   * 通用关键词提取：
   * 这些规则不理解代码语义，只抓“可能有检索价值”的文本。
   * 例如变量名、文件引用、form action、JSP include、request 参数等。
   */
  var keywords: string[] = [];
  var links: string[] = [];
  keywords = keywords.concat(collectMatches(content, /[A-Za-z_$][A-Za-z0-9_$]*(?:[A-Z][A-Za-z0-9_$]*)?/g));
  links = links.concat(collectMatches(content, /["']([^"']+\.(?:jsp|do|action|vue|java|xml|html|js|ts|css))["']/gi));
  links = links.concat(collectMatches(content, /\b([A-Za-z0-9_./-]+\.(?:jsp|do|action|vue|java|xml|html|js|ts|css))\b/gi));
  keywords = keywords.concat(collectMatches(content, /request\.getParameter\s*\(\s*["']([^"']+)["']\s*\)/g));
  keywords = keywords.concat(collectMatches(content, /request\.setAttribute\s*\(\s*["']([^"']+)["']\s*,/g));
  keywords = keywords.concat(collectMatches(content, /<form[^>]+action=["']([^"']+)["']/gi));
  links = links.concat(collectMatches(content, /<jsp:include[^>]+page=["']([^"']+)["']/gi));
  links = links.concat(collectMatches(content, /showModalDialog\s*\(\s*["']([^"']+)["']/gi));
  return {
    keywords: normalizeWords(keywords),
    links: normalizeWords(links)
  };
}

export function chunkTextFile(
  filePath: string,
  content: string,
  config: CtxConfig,
  typeName: string,
  name: string | undefined
): CodeChunk[] {
  /*
   * 普通文本切分策略：
   * - 每 maxLines 行形成一个 chunk；
   * - 下一个 chunk 回退 overlapLines 行，保留一点上下文；
   * - 这样函数或配置块刚好跨边界时，不至于完全断开。
   */
  var lines = content.split(/\r?\n/);
  var maxLines = Math.max(1, config.chunk.maxLines);
  var overlapLines = Math.max(0, Math.min(config.chunk.overlapLines, maxLines - 1));
  var chunks: CodeChunk[] = [];
  var start = 0;
  var index = 0;
  while (start < lines.length) {
    var end = Math.min(lines.length, start + maxLines);
    var slice = lines.slice(start, end).join("\n");
    chunks.push(createChunk(filePath, index, typeName, name, start + 1, end, slice, [], []));
    index++;
    if (end >= lines.length) {
      break;
    }
    start = end - overlapLines;
  }
  return chunks;
}
