import { CodeChunk } from "../store/types";

function fenceLanguage(language: string): string {
  if (language === "jsp") {
    return "jsp";
  }
  if (language === "java") {
    return "java";
  }
  if (language === "xml") {
    return "xml";
  }
  if (language === "vue") {
    return "vue";
  }
  return language || "text";
}

export function buildContextMarkdown(task: string, chunks: CodeChunk[]): string {
  var lines: string[] = [];
  lines.push("# Code Context");
  lines.push("");
  lines.push("## User Task");
  lines.push("");
  lines.push(task);
  lines.push("");
  lines.push("## Selected Files");
  lines.push("");
  for (var i = 0; i < chunks.length; i++) {
    lines.push("- " + chunks[i].filePath + ":" + chunks[i].startLine + "-" + chunks[i].endLine);
  }
  lines.push("");
  lines.push("## Context Chunks");
  lines.push("");
  for (var n = 0; n < chunks.length; n++) {
    var chunk = chunks[n];
    lines.push("### File: " + chunk.filePath);
    lines.push("");
    lines.push("Lines: " + chunk.startLine + "-" + chunk.endLine);
    lines.push("Type: " + chunk.type);
    if (chunk.name) {
      lines.push("Name: " + chunk.name);
    }
    lines.push("");
    lines.push("```" + fenceLanguage(chunk.language));
    lines.push(chunk.content);
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}
