import { CodeChunk } from "../store/types";

function hasPathBridge(a: CodeChunk, b: CodeChunk): boolean {
  for (var i = 0; i < a.links.length; i++) {
    var link = a.links[i].toLowerCase();
    if (b.filePath.toLowerCase().indexOf(link.replace(/^\//, "")) !== -1) {
      return true;
    }
  }
  return false;
}

export function applyRelationBoost(chunks: CodeChunk[]): CodeChunk[] {
  for (var i = 0; i < chunks.length; i++) {
    for (var n = 0; n < chunks.length; n++) {
      if (i === n) {
        continue;
      }
      if (hasPathBridge(chunks[i], chunks[n])) {
        chunks[i].score = (chunks[i].score || 0) + 10;
      }
    }
  }
  chunks.sort(function (a, b) {
    return (b.score || 0) - (a.score || 0);
  });
  return chunks;
}
