import { CodeChunk } from "../store/types";

function hasPathBridge(a: CodeChunk, b: CodeChunk): boolean {
  /*
   * 轻量关系判断：
   * 如果 chunk A 的 links 里出现了某个路径，而 chunk B 的 filePath 包含它，
   * 就认为 A 和 B 有关联。
   *
   * 这用于 JSP include、form action、Struts forward 等简单场景。
   */
  var links = a.links || [];
  for (var i = 0; i < links.length; i++) {
    var link = links[i].toLowerCase();
    if (b.filePath.toLowerCase().indexOf(link.replace(/^\//, "")) !== -1) {
      return true;
    }
  }
  return false;
}

export function applyRelationBoost(chunks: CodeChunk[]): CodeChunk[] {
  // 对已经命中的候选结果做二次加权，不扫描全量索引，保持实现简单。
  for (var i = 0; i < chunks.length; i++) {
    for (var n = 0; n < chunks.length; n++) {
      if (i === n) {
        continue;
      }
      if (hasPathBridge(chunks[i], chunks[n])) {
        var chunk = chunks[i];
        chunk.score = (chunk.score || 0) + 10;
        var details = chunk.scoreDetails;
        if (details) {
          details.relation = (details.relation || 0) + 10;
          details.total = chunk.score || 0;
        }
        var reasons = chunk.matchReasons;
        if (reasons) {
          reasons.push({
            field: "relation",
            token: chunks[n].filePath,
            weight: 10,
            detail: "linked path is also present in the candidate set"
          });
        }
      }
    }
  }
  chunks.sort(function (a, b) {
    return (b.score || 0) - (a.score || 0);
  });
  return chunks;
}
