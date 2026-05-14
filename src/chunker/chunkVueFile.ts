import { CtxConfig } from "../config/defaultConfig";
import { CodeChunk } from "../store/types";
import { createChunk } from "./buildChunks";

function lineNumberAt(content: string, index: number): number {
  // 根据字符下标计算行号，用于把 template/script/style 映射回原文件行号。
  return content.slice(0, index).split(/\r?\n/).length;
}

function findBlocks(content: string, tag: string): Array<{ start: number; end: number; bodyStart: number; bodyEnd: number }> {
  // 用正则找 SFC 中的 template/script/style 区块；第一版不解析 Vue AST。
  var result: Array<{ start: number; end: number; bodyStart: number; bodyEnd: number }> = [];
  var regex = new RegExp("<" + tag + "\\b[^>]*>([\\s\\S]*?)<\\/" + tag + ">", "gi");
  var match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    var wholeStart = match.index;
    var wholeEnd = regex.lastIndex;
    var openEnd = content.indexOf(">", wholeStart) + 1;
    result.push({ start: wholeStart, end: wholeEnd, bodyStart: openEnd, bodyEnd: wholeEnd - ("</" + tag + ">").length });
  }
  return result;
}

export function chunkVueFile(filePath: string, content: string, config: CtxConfig): CodeChunk[] {
  /*
   * Vue SFC 天然分成 template/script/style 三块。
   * 先按这三块切，script 里再额外识别 function/const/let/var 声明，
   * 让搜索某个方法名时更容易命中具体片段。
   */
  var chunks: CodeChunk[] = [];
  var tags = ["template", "script", "style"];
  for (var i = 0; i < tags.length; i++) {
    var blocks = findBlocks(content, tags[i]);
    for (var b = 0; b < blocks.length; b++) {
      var block = blocks[b];
      var body = content.slice(block.bodyStart, block.bodyEnd);
      var startLine = lineNumberAt(content, block.bodyStart);
      var endLine = lineNumberAt(content, block.bodyEnd);
      chunks.push(createChunk(filePath, chunks.length, "vue-" + tags[i], tags[i], startLine, endLine, body, [], []));
      if (tags[i] === "script") {
        var lines = body.split(/\r?\n/);
        for (var n = 0; n < lines.length; n++) {
          if (/\b(function|const|let|var)\s+[A-Za-z_$][A-Za-z0-9_$]*/.test(lines[n])) {
            var start = n;
            var end = Math.min(lines.length, n + config.chunk.maxLines);
            var part = lines.slice(start, end).join("\n");
            var nameMatch = lines[n].match(/\b(function|const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
            chunks.push(createChunk(filePath, chunks.length, "vue-script-symbol", nameMatch ? nameMatch[2] : undefined, startLine + start, startLine + end - 1, part, [], []));
          }
        }
      }
    }
  }
  if (chunks.length === 0) {
    // 非标准 .vue 文件也不要丢弃，退回单 chunk。
    chunks.push(createChunk(filePath, 0, "vue", undefined, 1, content.split(/\r?\n/).length, content, [], []));
  }
  return chunks;
}
