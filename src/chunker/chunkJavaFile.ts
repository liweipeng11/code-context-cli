import { CtxConfig } from "../config/defaultConfig";
import { CodeChunk } from "../store/types";
import { createChunk } from "./buildChunks";
import { chunkTextFile } from "./chunkTextFile";

function findJavaName(line: string): string | undefined {
  var method = line.match(/\b(public|private|protected)\s+(?:static\s+)?[A-Za-z0-9_<>\[\], ?]+\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
  if (method) {
    return method[2];
  }
  var clazz = line.match(/\b(class|interface|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (clazz) {
    return clazz[2];
  }
  return undefined;
}

function collect(content: string, regex: RegExp): string[] {
  var result: string[] = [];
  var match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    result.push(match[1] || match[0]);
  }
  return result;
}

export function chunkJavaFile(filePath: string, content: string, config: CtxConfig): CodeChunk[] {
  var lines = content.split(/\r?\n/);
  var starts: number[] = [];
  for (var i = 0; i < lines.length; i++) {
    if (/\b(class|interface|enum)\s+[A-Za-z_$]/.test(lines[i]) || /\b(public|private|protected)\s+(?:static\s+)?[A-Za-z0-9_<>\[\], ?]+\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\(/.test(lines[i])) {
      starts.push(i);
    }
  }
  if (starts.length === 0) {
    return chunkTextFile(filePath, content, config, "java", undefined);
  }
  var chunks: CodeChunk[] = [];
  for (var s = 0; s < starts.length; s++) {
    var start = starts[s];
    var end = s + 1 < starts.length ? starts[s + 1] : lines.length;
    var part = lines.slice(start, end).join("\n");
    var name = findJavaName(lines[start]);
    var typeName = /\b(class|interface|enum)\s+/.test(lines[start]) ? "java-class" : "java-method";
    var keywords = collect(part, /request\.getParameter\s*\(\s*["']([^"']+)["']\s*\)/g)
      .concat(collect(part, /request\.setAttribute\s*\(\s*["']([^"']+)["']\s*,/g))
      .concat(collect(part, /mapping\.findForward\s*\(\s*["']([^"']+)["']\s*\)/g))
      .concat(collect(part, /\bforward\b/g));
    var links = collect(part, /mapping\.findForward\s*\(\s*["']([^"']+)["']\s*\)/g);
    chunks.push(createChunk(filePath, chunks.length, typeName, name, start + 1, end, part, keywords, links));
  }
  return chunks;
}
