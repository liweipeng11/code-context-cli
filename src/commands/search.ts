import { loadIndex } from "../store/indexStore";
import { keywordSearch } from "../retriever/keywordSearch";
import { applyRelationBoost } from "../retriever/rankChunks";
import { info } from "../utils/logger";

function summarize(content: string): string {
  // 终端搜索结果只展示摘要，完整内容仍保存在 index.json 和 context.md 中。
  var compact = content.replace(/\s+/g, " ").trim();
  if (compact.length > 180) {
    return compact.slice(0, 180) + "...";
  }
  return compact;
}

export function runSearch(rootDir: string, query: string, topN: number): void {
  var index = loadIndex(rootDir);
  // 先按关键词打分，再根据 chunk 之间的路径/forward/include 关系做轻量加权。
  var results = applyRelationBoost(keywordSearch(index.chunks, query, topN));
  if (results.length === 0) {
    info("No matching chunks found.");
    return;
  }
  for (var i = 0; i < results.length; i++) {
    var chunk = results[i];
    info("[" + (i + 1) + "] " + chunk.filePath + ":" + chunk.startLine + "-" + chunk.endLine + " score=" + (chunk.score || 0));
    info(summarize(chunk.content));
    info("");
  }
}
