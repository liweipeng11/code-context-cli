import { CtxConfig } from "../config/defaultConfig";
import { CodeChunk } from "../store/types";
import { createChunk } from "./buildChunks";
import { chunkTextFile } from "./chunkTextFile";

function collectAttrs(content: string): string[] {
  // Struts action 常见属性，这些属性往往能把 JSP、Action、forward 关联起来。
  var attrs = ["path", "type", "name", "scope", "input"];
  var result: string[] = [];
  for (var i = 0; i < attrs.length; i++) {
    var regex = new RegExp("\\b" + attrs[i] + "=[\"']([^\"']+)[\"']", "gi");
    var match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      result.push(match[1]);
    }
  }
  return result;
}

export function chunkXmlFile(filePath: string, content: string, config: CtxConfig): CodeChunk[] {
  /*
   * XML 中最重要的场景是 struts-config.xml。
   * 这里把每个 <action>...</action> 单独切成 chunk，
   * 这样搜索某个 .do 或 action path 时，可以直接带出对应配置。
   */
  if (filePath.toLowerCase().indexOf("struts-config.xml") === -1 && content.indexOf("<action") === -1) {
    return chunkTextFile(filePath, content, config, "xml", undefined);
  }
  var lines = content.split(/\r?\n/);
  var chunks: CodeChunk[] = [];
  var i = 0;
  while (i < lines.length) {
    if (/<action\b/i.test(lines[i])) {
      // 从 <action> 开始向后找到 </action> 或自闭合结束。
      var start = i;
      var end = i;
      while (end < lines.length && !/<\/action>/i.test(lines[end]) && !/\/>\s*$/.test(lines[end])) {
        end++;
      }
      if (end >= lines.length) {
        end = lines.length - 1;
      }
      var part = lines.slice(start, end + 1).join("\n");
      var pathMatch = part.match(/\bpath=["']([^"']+)["']/i);
      var name = pathMatch ? pathMatch[1] : undefined;
      var keywords = collectAttrs(part);
      var links = collectAttrs(part);
      chunks.push(createChunk(filePath, chunks.length, "struts-action", name, start + 1, end + 1, part, keywords, links));
      i = end + 1;
    } else {
      i++;
    }
  }
  if (chunks.length === 0) {
    return chunkTextFile(filePath, content, config, "xml", undefined);
  }
  return chunks;
}
