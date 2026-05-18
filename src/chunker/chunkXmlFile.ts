import { CtxConfig } from "../config/defaultConfig";
import { CodeChunk } from "../store/types";
import { createChunk } from "./buildChunks";
import { chunkTextFile } from "./chunkTextFile";

function collect(content: string, regex: RegExp): string[] {
  var result: string[] = [];
  var match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    result.push(match[1] || match[0]);
  }
  return result;
}

function collectAttrs(content: string): string[] {
  var attrs = ["path", "type", "name", "scope", "input"];
  var result: string[] = [];
  for (var i = 0; i < attrs.length; i++) {
    var regex = new RegExp("\\b" + attrs[i] + "=[\"']([^\"']+)[\"']", "gi");
    result = result.concat(collect(content, regex));
  }
  return result;
}

export function chunkXmlFile(filePath: string, content: string, config: CtxConfig): CodeChunk[] {
  if (filePath.toLowerCase().indexOf("struts-config.xml") === -1 && content.indexOf("<action") === -1) {
    return chunkTextFile(filePath, content, config, "xml-text", undefined);
  }

  var lines = content.split(/\r?\n/);
  var chunks: CodeChunk[] = [];
  var i = 0;
  while (i < lines.length) {
    if (/<action\b/i.test(lines[i])) {
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
      var forwardNames = collect(part, /<forward\b[^>]*\bname=["']([^"']+)["']/gi);
      var forwardPaths = collect(part, /<forward\b[^>]*\bpath=["']([^"']+)["']/gi);
      var keywords = collectAttrs(part).concat(forwardNames);
      var links = collectAttrs(part).concat(forwardPaths);
      chunks.push(createChunk(filePath, chunks.length, "xml-struts-action", name, start + 1, end + 1, part, keywords, links, name ? [name] : []));
      i = end + 1;
    } else {
      i++;
    }
  }

  if (chunks.length === 0) {
    return chunkTextFile(filePath, content, config, "xml-text", undefined);
  }
  return chunks;
}
