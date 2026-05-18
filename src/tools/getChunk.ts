import { loadIndex } from "../store/indexStore";
import { CodeChunk } from "../store/types";

export function getChunkById(rootDir: string, chunkId: string): CodeChunk {
  var index = loadIndex(rootDir);
  for (var i = 0; i < index.chunks.length; i++) {
    if (index.chunks[i].id === chunkId) {
      return index.chunks[i];
    }
  }
  throw new Error("Chunk not found: " + chunkId);
}
