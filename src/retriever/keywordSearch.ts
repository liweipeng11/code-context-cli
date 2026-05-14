import path = require("path");
import { CodeChunk } from "../store/types";

export function tokenizeQuery(query: string): string[] {
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
  for (var i = 0; i < values.length; i++) {
    if (values[i].toLowerCase().indexOf(token) !== -1) {
      return true;
    }
  }
  return false;
}

function queryMentionsFile(query: string, filePath: string): boolean {
  var base = path.basename(filePath).toLowerCase();
  return query.toLowerCase().indexOf(base) !== -1;
}

export function scoreChunk(chunk: CodeChunk, query: string, tokens: string[]): number {
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
  var tokens = tokenizeQuery(query);
  var scored: CodeChunk[] = [];
  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i];
    var score = scoreChunk(chunk, query, tokens);
    if (score > 0) {
      var copy: CodeChunk = {
        id: chunk.id,
        filePath: chunk.filePath,
        language: chunk.language,
        type: chunk.type,
        name: chunk.name,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        keywords: chunk.keywords,
        links: chunk.links,
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
