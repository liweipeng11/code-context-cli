import fs = require("fs");
import { loadConfig } from "../config/loadConfig";
import { loadIndex, ensureCtxDir } from "../store/indexStore";
import { keywordSearch } from "../retriever/keywordSearch";
import { applyRelationBoost } from "../retriever/rankChunks";
import { selectContext } from "../budget/selectContext";
import { buildContextMarkdown } from "../prompt/buildContextMarkdown";
import { getContextPath } from "../utils/pathUtils";
import { info } from "../utils/logger";

export function runContext(rootDir: string, query: string, topN: number): void {
  /*
   * context 命令可以理解为 search 的“LLM 版本”：
   * 1. 先检索候选 chunk；
   * 2. 根据 token 预算挑选能放进去的 chunk；
   * 3. 生成结构化 Markdown，方便用户复制给 LLM。
   */
  var config = loadConfig(rootDir);
  var index = loadIndex(rootDir);
  var ranked = applyRelationBoost(keywordSearch(index.chunks, query, topN));
  var selected = selectContext(ranked, config.context.maxTokens, config.context.reserveOutputTokens);
  var markdown = buildContextMarkdown(query, selected);
  ensureCtxDir(rootDir);
  fs.writeFileSync(getContextPath(rootDir), markdown, "utf8");
  info("Selected " + selected.length + " chunks.");
  info("Wrote .ctx/context.md");
}
