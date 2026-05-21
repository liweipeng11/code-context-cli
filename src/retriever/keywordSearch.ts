import path = require("path");
import { CodeChunk, SearchMatchReason, SearchScoreDetails } from "../store/types";

interface FieldText {
  field: string;
  text: string;
  weight: number;
  bucket: keyof SearchScoreDetails;
}

interface Bm25Document {
  terms: string[];
  frequencies: { [term: string]: number };
}

var INTENT_EXPANSIONS: { [term: string]: string[] } = {
  "保存": ["save", "submit", "commit", "update", "insert", "create", "add", "保存", "提交", "确定"],
  "提交": ["submit", "save", "commit", "post", "ajax", "request", "提交", "保存"],
  "弹窗": ["dialog", "modal", "popup", "window", "layer", "open", "close", "show", "hide", "弹窗", "窗口"],
  "窗口": ["dialog", "modal", "popup", "window", "layer", "弹窗", "窗口"],
  "逻辑": ["logic", "handler", "function", "method", "action", "event", "click", "callback", "逻辑"],
  "查询": ["query", "search", "find", "select", "load", "filter", "list", "查询", "搜索"],
  "搜索": ["search", "query", "find", "filter", "搜索", "查询"],
  "删除": ["delete", "remove", "del", "删除"],
  "新增": ["add", "create", "insert", "new", "新增"],
  "修改": ["edit", "update", "modify", "change", "修改"],
  "详情": ["detail", "info", "view", "详情"]
};

export function tokenizeQuery(query: string): string[] {
  var result: string[] = [];
  var english = query.match(/[A-Za-z0-9_./-]+/g);
  if (english) {
    for (var e = 0; e < english.length; e++) {
      result = result.concat(splitAsciiToken(english[e]));
    }
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
  return uniqueLower(result);
}

function splitAsciiToken(token: string): string[] {
  var withSpaces = token.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  var parts = withSpaces.split(/[^A-Za-z0-9_]+/);
  var result: string[] = [token];
  for (var i = 0; i < parts.length; i++) {
    if (parts[i]) {
      result.push(parts[i]);
    }
  }
  return result;
}

function uniqueLower(values: string[]): string[] {
  var seen: { [key: string]: boolean } = {};
  var unique: string[] = [];
  for (var i = 0; i < values.length; i++) {
    var token = values[i].toLowerCase();
    if (token.length > 0 && !seen[token]) {
      seen[token] = true;
      unique.push(token);
    }
  }
  return unique;
}

function expandIntentTokens(tokens: string[]): string[] {
  var expanded = tokens.slice();
  for (var i = 0; i < tokens.length; i++) {
    var more = INTENT_EXPANSIONS[tokens[i]];
    if (more) {
      expanded = expanded.concat(more);
    }
  }
  return uniqueLower(expanded);
}

function safeValues(values: string[] | undefined): string[] {
  return values || [];
}

function metadataValues(chunk: CodeChunk): string[] {
  if (!chunk.metadata) {
    return [];
  }
  var meta = chunk.metadata;
  var result: string[] = [];
  function add(values: string[] | undefined): void {
    if (values) {
      result = result.concat(values);
    }
  }
  add(meta.domIds);
  add(meta.formActions);
  add(meta.fields);
  add(meta.buttons);
  add(meta.tableColumns);
  add(meta.jsFunctions);
  add(meta.events);
  add(meta.jspVars);
  add(meta.jspScriptlets);
  add(meta.jstlVars);
  add(meta.includePaths);
  add(meta.externalJs);
  add(meta.externalCss);
  if (meta.regionId) {
    result.push(meta.regionId);
  }
  if (meta.regionType) {
    result.push(meta.regionType);
  }
  if (meta.regionName) {
    result.push(meta.regionName);
  }
  if (meta.parentRegionId) {
    result.push(meta.parentRegionId);
  }
  return result;
}

function fieldsForChunk(chunk: CodeChunk): FieldText[] {
  return [
    { field: "filename", text: path.basename(chunk.filePath), weight: 14, bucket: "filename" },
    { field: "path", text: chunk.filePath, weight: 8, bucket: "path" },
    { field: "name", text: chunk.name || "", weight: 10, bucket: "symbol" },
    { field: "symbols", text: safeValues(chunk.symbols).join(" "), weight: 9, bucket: "symbol" },
    { field: "metadata", text: metadataValues(chunk).join(" "), weight: 7, bucket: "metadata" },
    { field: "keywords", text: safeValues(chunk.keywords).join(" "), weight: 6, bucket: "keyword" },
    { field: "links", text: safeValues(chunk.links).join(" "), weight: 6, bucket: "metadata" },
    { field: "summary", text: chunk.summary || "", weight: 6, bucket: "keyword" },
    { field: "type", text: chunk.type, weight: 3, bucket: "metadata" },
    { field: "content", text: chunk.content, weight: 2, bucket: "keyword" }
  ];
}

function emptyDetails(): SearchScoreDetails {
  return {
    keyword: 0,
    path: 0,
    filename: 0,
    symbol: 0,
    metadata: 0,
    bm25: 0,
    relation: 0,
    total: 0
  };
}

function addReason(reasons: SearchMatchReason[], field: string, token: string, weight: number, detail: string): void {
  if (reasons.length >= 40) {
    return;
  }
  reasons.push({ field: field, token: token, weight: round(weight), detail: detail });
}

function scoreFieldMatches(chunk: CodeChunk, tokens: string[], details: SearchScoreDetails, reasons: SearchMatchReason[]): void {
  var fields = fieldsForChunk(chunk);
  for (var f = 0; f < fields.length; f++) {
    var field = fields[f];
    var text = field.text.toLowerCase();
    if (!text) {
      continue;
    }
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (text.indexOf(token) !== -1) {
        details[field.bucket] += field.weight;
        addReason(reasons, field.field, token, field.weight, field.field + " contains '" + token + "'");
      }
    }
  }
}

function queryMentionsFile(query: string, filePath: string, details: SearchScoreDetails, reasons: SearchMatchReason[]): void {
  var base = path.basename(filePath).toLowerCase();
  if (query.toLowerCase().indexOf(base) !== -1) {
    details.filename += 15;
    addReason(reasons, "filename", base, 15, "query mentions the exact file name");
  }
}

function searchableText(chunk: CodeChunk): string {
  return [
    chunk.filePath,
    path.basename(chunk.filePath),
    chunk.type,
    chunk.name || "",
    chunk.summary || "",
    safeValues(chunk.keywords).join(" "),
    safeValues(chunk.links).join(" "),
    safeValues(chunk.symbols).join(" "),
    metadataValues(chunk).join(" "),
    chunk.content
  ].join(" ");
}

function tokenizeDocument(text: string): string[] {
  return tokenizeQuery(text);
}

function buildBm25Documents(chunks: CodeChunk[]): Bm25Document[] {
  var docs: Bm25Document[] = [];
  for (var i = 0; i < chunks.length; i++) {
    var terms = tokenizeDocument(searchableText(chunks[i]));
    var frequencies: { [term: string]: number } = {};
    for (var n = 0; n < terms.length; n++) {
      frequencies[terms[n]] = (frequencies[terms[n]] || 0) + 1;
    }
    docs.push({ terms: terms, frequencies: frequencies });
  }
  return docs;
}

function documentFrequencies(docs: Bm25Document[]): { [term: string]: number } {
  var df: { [term: string]: number } = {};
  for (var i = 0; i < docs.length; i++) {
    var seen: { [term: string]: boolean } = {};
    for (var n = 0; n < docs[i].terms.length; n++) {
      seen[docs[i].terms[n]] = true;
    }
    for (var term in seen) {
      if (Object.prototype.hasOwnProperty.call(seen, term)) {
        df[term] = (df[term] || 0) + 1;
      }
    }
  }
  return df;
}

function bm25Score(doc: Bm25Document, queryTokens: string[], df: { [term: string]: number }, docCount: number, avgLength: number): number {
  var k1 = 1.2;
  var b = 0.75;
  var score = 0;
  var length = Math.max(doc.terms.length, 1);
  for (var i = 0; i < queryTokens.length; i++) {
    var token = queryTokens[i];
    var freq = doc.frequencies[token] || 0;
    if (freq === 0) {
      continue;
    }
    var docsWithTerm = df[token] || 0;
    var idf = Math.log(1 + (docCount - docsWithTerm + 0.5) / (docsWithTerm + 0.5));
    var denom = freq + k1 * (1 - b + b * (length / Math.max(avgLength, 1)));
    score += idf * ((freq * (k1 + 1)) / denom);
  }
  return score * 4;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function copyChunk(chunk: CodeChunk, score: number, details: SearchScoreDetails, reasons: SearchMatchReason[]): CodeChunk {
  details.total = round(score);
  return {
    id: chunk.id,
    filePath: chunk.filePath,
    fileHash: chunk.fileHash,
    language: chunk.language,
    type: chunk.type,
    name: chunk.name,
    summary: chunk.summary,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    content: chunk.content,
    keywords: chunk.keywords,
    links: chunk.links,
    symbols: chunk.symbols,
    metadata: chunk.metadata,
    score: round(score),
    scoreDetails: details,
    matchReasons: reasons
  };
}

export function scoreChunk(chunk: CodeChunk, query: string, tokens: string[]): number {
  var details = emptyDetails();
  var reasons: SearchMatchReason[] = [];
  var expandedTokens = expandIntentTokens(tokens);
  scoreFieldMatches(chunk, expandedTokens, details, reasons);
  queryMentionsFile(query, chunk.filePath, details, reasons);
  return details.keyword + details.path + details.filename + details.symbol + details.metadata;
}

export function keywordSearch(chunks: CodeChunk[], query: string, topN: number): CodeChunk[] {
  var queryTokens = expandIntentTokens(tokenizeQuery(query));
  var docs = buildBm25Documents(chunks);
  var df = documentFrequencies(docs);
  var totalLength = 0;
  for (var d = 0; d < docs.length; d++) {
    totalLength += docs[d].terms.length;
  }
  var avgLength = docs.length === 0 ? 0 : totalLength / docs.length;
  var scored: CodeChunk[] = [];

  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i];
    var details = emptyDetails();
    var reasons: SearchMatchReason[] = [];
    scoreFieldMatches(chunk, queryTokens, details, reasons);
    queryMentionsFile(query, chunk.filePath, details, reasons);
    details.bm25 = round(bm25Score(docs[i], queryTokens, df, docs.length, avgLength));
    if (details.bm25 > 0) {
      addReason(reasons, "bm25", queryTokens.join(" "), details.bm25, "local BM25 matched query or intent-expanded terms");
    }
    var score = details.keyword + details.path + details.filename + details.symbol + details.metadata + details.bm25;
    if (score > 0) {
      scored.push(copyChunk(chunk, score, details, reasons));
    }
  }

  scored.sort(function (a, b) {
    return (b.score || 0) - (a.score || 0);
  });
  return scored.slice(0, topN);
}
