import path = require("path");
import { CodeChunk } from "../store/types";

export function tokenizeQuery(query: string): string[] {
  /*
   * 第一版没有 LLM/embedding，所以 query 只能做轻量分词：
   * - 英文、数字、下划线、路径片段按连续 token 提取；
   * - 中文按 2 字滑窗切分，提升短语命中的概率。
   *
   * 例如“登录逻辑在哪里”会产生“登录”“录逻”“逻辑”等二字片段。
   */
  var result: string[] = [];
  var english = query.match(/[A-Za-z0-9_./-]+/g);
  if (english) {
    result = result.concat(english);
  }
  var chinese = query.match(/[\u4e00-\u9fff]+/g);
  if (chinese) {
    for (var i = 0; i < chinese.length; i++) {
      var text = chinese[i];
      if (text.length <= 2) {
        result.push(text);
      } else {
        for (var n = 0; n < text.length - 1; n++) {
          result.push(text.slice(n, n + 2));
        }
      }
    }
  }
  var seen: { [key: string]: boolean } = {};
  var unique: string[] = [];
  for (var u = 0; u < result.length; u++) {
    var token = result[u].toLowerCase();
    if (token.length > 0 && !seen[token]) {
      seen[token] = true;
      unique.push(token);
    }
  }
  return unique;
}

function includesAny(values: string[], token: string): boolean {
  // keywords/links 里只要有一个值包含 token，就认为命中。
  for (var i = 0; i < values.length; i++) {
    if (values[i].toLowerCase().indexOf(token) !== -1) {
      return true;
    }
  }
  return false;
}

function queryMentionsFile(query: string, filePath: string): boolean {
  // 如果用户直接写了文件名，例如 UserDetail.jsp，要给更高权重。
  var base = path.basename(filePath).toLowerCase();
  return query.toLowerCase().indexOf(base) !== -1;
}

export function scoreChunk(chunk: CodeChunk, query: string, tokens: string[]): number {
  /*
   * 评分不是语义理解，只是“不同位置命中不同加权”：
   * - 路径命中通常很强，所以 +8；
   * - keywords/links 是提前提取的结构化线索，所以 +5；
   * - content 全文命中噪声更高，所以 +2。
   */
  var score = 0;
  var filePath = chunk.filePath.toLowerCase();
  var content = chunk.content.toLowerCase();
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (filePath.indexOf(token) !== -1) {
      score += 8;
    }
    if (includesAny(chunk.keywords, token)) {
      score += 5;
    }
    if (includesAny(chunk.links, token)) {
      score += 5;
    }
    if (content.indexOf(token) !== -1) {
      score += 2;
    }
  }
  if (queryMentionsFile(query, chunk.filePath)) {
    score += 15;
  }
  return score;
}

export function keywordSearch(chunks: CodeChunk[], query: string, topN: number): CodeChunk[] {
  // 搜索结果复制一份 chunk，并把 score 放在副本上，避免污染原始索引对象。
  var tokens = tokenizeQuery(query);
  var scored: CodeChunk[] = [];
  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i];
    var score = scoreChunk(chunk, query, tokens);
    if (score > 0) {
      var copy: CodeChunk = {
        id: chunk.id,
        filePath: chunk.filePath,
        fileHash: chunk.fileHash,
        language: chunk.language,
        type: chunk.type,
        name: chunk.name,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        keywords: chunk.keywords,
        links: chunk.links,
        symbols: chunk.symbols,
        score: score
      };
      scored.push(copy);
    }
  }
  scored.sort(function (a, b) {
    return (b.score || 0) - (a.score || 0);
  });
  return scored.slice(0, topN);
}
