import { CtxConfig } from "../config/defaultConfig";
import { CodeChunk } from "../store/types";
import { createChunk, normalizeWords } from "./buildChunks";

export interface KeywordResult {
  keywords: string[];
  links: string[];
}

function collectMatches(content: string, regex: RegExp): string[] {
  var result: string[] = [];
  var match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    result.push(match[1] || match[0]);
  }
  return result;
}

export function extractCommonKeywords(content: string): KeywordResult {
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
