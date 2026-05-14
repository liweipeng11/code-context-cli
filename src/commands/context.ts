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
