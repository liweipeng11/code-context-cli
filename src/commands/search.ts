import { loadIndex } from "../store/indexStore";
import { keywordSearch } from "../retriever/keywordSearch";
import { applyRelationBoost } from "../retriever/rankChunks";
import { CodeChunk } from "../store/types";
import { info } from "../utils/logger";

function summarize(content: string): string {
  var compact = content.replace(/\s+/g, " ").trim();
  if (compact.length > 180) {
    return compact.slice(0, 180) + "...";
  }
  return compact;
}

function toJsonResult(chunk: CodeChunk): object {
  return {
    id: chunk.id,
    filePath: chunk.filePath,
    language: chunk.language,
    type: chunk.type,
    name: chunk.name,
    summary: chunk.summary,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    score: chunk.score || 0,
    scoreDetails: chunk.scoreDetails,
    matchReasons: chunk.matchReasons || [],
    keywords: chunk.keywords || [],
    links: chunk.links || [],
    symbols: chunk.symbols || [],
    metadata: chunk.metadata,
    content: chunk.content
  };
}

export function runSearch(rootDir: string, query: string, topN: number, json: boolean): void {
  var index = loadIndex(rootDir);
  var results = applyRelationBoost(keywordSearch(index.chunks, query, topN));

  if (json) {
    info(JSON.stringify({
      query: query,
      top: topN,
      count: results.length,
      retrieval: {
        keyword: true,
        pathWeighting: true,
        symbolSearch: true,
        metadataSearch: true,
        bm25: true,
        embedding: false,
        rerank: false
      },
      results: results.map(toJsonResult)
    }, null, 2));
    return;
  }

  if (results.length === 0) {
    info("No matching chunks found.");
    return;
  }
  for (var i = 0; i < results.length; i++) {
    var chunk = results[i];
    info("[" + (i + 1) + "] " + chunk.filePath + ":" + chunk.startLine + "-" + chunk.endLine + " score=" + (chunk.score || 0));
    if (chunk.scoreDetails) {
      info("score details: keyword=" + chunk.scoreDetails.keyword + " path=" + chunk.scoreDetails.path + " filename=" + chunk.scoreDetails.filename + " symbol=" + chunk.scoreDetails.symbol + " metadata=" + chunk.scoreDetails.metadata + " bm25=" + chunk.scoreDetails.bm25 + " relation=" + chunk.scoreDetails.relation);
    }
    if (chunk.matchReasons && chunk.matchReasons.length > 0) {
      info("reasons: " + chunk.matchReasons.slice(0, 5).map(function (reason) {
        return reason.field + ":" + reason.token + "(+" + reason.weight + ")";
      }).join(", "));
    }
    info(summarize(chunk.content));
    info("");
  }
}
