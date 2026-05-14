import { CodeChunk } from "../store/types";
import { estimateTokens } from "../utils/tokenEstimate";

export function selectContext(chunks: CodeChunk[], maxTokens: number, reserveOutputTokens: number): CodeChunk[] {
  var budget = Math.max(0, maxTokens - reserveOutputTokens);
  var selected: CodeChunk[] = [];
  var used = 0;
  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i];
    var cost = estimateTokens(chunk.content) + estimateTokens(chunk.filePath) + 20;
    if (used + cost > budget) {
      break;
    }
    selected.push(chunk);
    used += cost;
  }
  return selected;
}
