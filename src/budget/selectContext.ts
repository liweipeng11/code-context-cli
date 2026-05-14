import { CodeChunk } from "../store/types";
import { estimateTokens } from "../utils/tokenEstimate";

export function selectContext(chunks: CodeChunk[], maxTokens: number, reserveOutputTokens: number): CodeChunk[] {
  /*
   * context.md 不能无限大，所以这里根据 token 预算从高分到低分挑选。
   * 第一版不做复杂合并：一旦下一个 chunk 超预算，就停止。
   */
  var budget = Math.max(0, maxTokens - reserveOutputTokens);
  var selected: CodeChunk[] = [];
  var used = 0;
  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i];
    // 额外加一点固定成本，粗略覆盖 Markdown 标题、行号等包装文本。
    var cost = estimateTokens(chunk.content) + estimateTokens(chunk.filePath) + 20;
    if (used + cost > budget) {
      break;
    }
    selected.push(chunk);
    used += cost;
  }
  return selected;
}
