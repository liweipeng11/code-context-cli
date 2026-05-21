import path = require("path");
import { buildJspPageMap } from "../jsp/buildJspPageMap";
import { selectJspContext } from "../jsp/selectJspContext";
import { traceJspDependencies, RelatedChunk } from "../jsp/traceJspDependencies";
import { loadIndex } from "../store/indexStore";
import { CodeChunk } from "../store/types";
import { info } from "../utils/logger";
import { toDisplayPath } from "../utils/pathUtils";

interface RegionSummary {
  id: string;
  type: string;
  name?: string;
  summary?: string;
  filePath: string;
  startLine: number;
  endLine: number;
  keywords: string[];
  links: string[];
  symbols: string[];
  metadata?: CodeChunk["metadata"];
}

function normalizeInputPath(filePath: string): string {
  return toDisplayPath(filePath);
}

function sameFile(chunk: CodeChunk, filePath: string): boolean {
  return normalizeInputPath(chunk.filePath).toLowerCase() === normalizeInputPath(filePath).toLowerCase();
}

function isJspRegion(chunk: CodeChunk): boolean {
  return chunk.language === "jsp" && chunk.type.indexOf("jsp-") === 0;
}

function regionId(chunk: CodeChunk): string {
  return chunk.metadata && chunk.metadata.regionId ? chunk.metadata.regionId : path.basename(chunk.filePath) + "-" + chunk.startLine;
}

function toSummary(chunk: CodeChunk): RegionSummary {
  return {
    id: regionId(chunk),
    type: chunk.type,
    name: chunk.name,
    summary: chunk.summary,
    filePath: chunk.filePath,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    keywords: chunk.keywords || [],
    links: chunk.links || [],
    symbols: chunk.symbols || [],
    metadata: chunk.metadata
  };
}

function getRegions(rootDir: string, filePath: string): CodeChunk[] {
  var index = loadIndex(rootDir);
  var result: CodeChunk[] = [];
  for (var i = 0; i < index.chunks.length; i++) {
    var chunk = index.chunks[i];
    if (sameFile(chunk, filePath) && isJspRegion(chunk)) {
      result.push(chunk);
    }
  }
  result.sort(function (a, b) {
    return a.startLine - b.startLine;
  });
  return result;
}

function findRegion(rootDir: string, filePath: string, id: string): CodeChunk {
  var regions = getRegions(rootDir, filePath);
  for (var i = 0; i < regions.length; i++) {
    var chunk = regions[i];
    if (regionId(chunk) === id || chunk.id === id || chunk.name === id) {
      return chunk;
    }
  }
  throw new Error("JSP region not found: " + id + " in " + filePath);
}

function collectMetadataValues(chunk: CodeChunk): string[] {
  var values = (chunk.keywords || []).concat(chunk.links || []).concat(chunk.symbols || []);
  if (chunk.metadata) {
    values = values
      .concat(chunk.metadata.formActions || [])
      .concat(chunk.metadata.includePaths || [])
      .concat(chunk.metadata.jsFunctions || [])
      .concat(chunk.metadata.events || [])
      .concat(chunk.metadata.fields || [])
      .concat(chunk.metadata.domIds || []);
  }
  var result: string[] = [];
  var seen: { [key: string]: boolean } = {};
  for (var i = 0; i < values.length; i++) {
    var value = values[i];
    if (!value || value.length < 2) {
      continue;
    }
    var key = value.toLowerCase();
    if (!seen[key]) {
      seen[key] = true;
      result.push(value);
    }
  }
  return result;
}

function hasKeywordHit(chunk: CodeChunk, values: string[]): boolean {
  var haystack = ((chunk.name || "") + "\n" + (chunk.summary || "") + "\n" + chunk.content).toLowerCase();
  for (var i = 0; i < values.length; i++) {
    if (haystack.indexOf(values[i].toLowerCase()) >= 0) {
      return true;
    }
  }
  return false;
}

function collectLowPriorityContext(rootDir: string, primary: CodeChunk, related: RelatedChunk[]): RelatedChunk[] {
  var index = loadIndex(rootDir);
  var used: { [id: string]: boolean } = {};
  used[primary.id] = true;
  for (var r = 0; r < related.length; r++) {
    used[related[r].chunk.id] = true;
  }

  var values = collectMetadataValues(primary);
  var result: RelatedChunk[] = [];
  for (var i = 0; i < index.chunks.length && result.length < 20; i++) {
    var chunk = index.chunks[i];
    if (used[chunk.id]) {
      continue;
    }
    if (sameFile(chunk, primary.filePath) && chunk.type === "jsp-script") {
      result.push({ chunk: chunk, priority: "low", reason: "same-page broad script chunk" });
      used[chunk.id] = true;
      continue;
    }
    if (values.length > 0 && hasKeywordHit(chunk, values)) {
      result.push({ chunk: chunk, priority: "low", reason: "keyword hit from current JSP region" });
      used[chunk.id] = true;
    }
  }
  return result;
}

function printRegionList(chunks: CodeChunk[]): void {
  if (chunks.length === 0) {
    info("No JSP regions found. Run ctx index . after updating the project.");
    return;
  }
  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i];
    info("[" + (i + 1) + "] " + regionId(chunk) + " " + chunk.type + " " + chunk.filePath + ":" + chunk.startLine + "-" + chunk.endLine);
    if (chunk.name) {
      info("Name: " + chunk.name);
    }
    if (chunk.symbols && chunk.symbols.length > 0) {
      info("Symbols: " + chunk.symbols.slice(0, 12).join(", "));
    }
    info("");
  }
}

function printRegion(chunk: CodeChunk, related: RelatedChunk[]): void {
  info("Region: " + regionId(chunk));
  info("File: " + chunk.filePath);
  info("Lines: " + chunk.startLine + "-" + chunk.endLine);
  info("Type: " + chunk.type);
  if (chunk.name) {
    info("Name: " + chunk.name);
  }
  info("");
  info("```jsp");
  info(chunk.content);
  info("```");
  if (related.length === 0) {
    return;
  }
  info("");
  info("Related chunks:");
  for (var i = 0; i < related.length; i++) {
    var item = related[i];
    info("- [" + item.priority + "] " + item.chunk.id + " " + item.chunk.type + " " + item.chunk.filePath + ":" + item.chunk.startLine + "-" + item.chunk.endLine);
    info("  Reason: " + item.reason);
  }
}

export function runJspRegions(rootDir: string, filePath: string, json: boolean): void {
  var regions = getRegions(rootDir, filePath);
  if (json) {
    info(JSON.stringify(regions.map(toSummary), null, 2));
    return;
  }
  printRegionList(regions);
}

export function runJspRegion(rootDir: string, filePath: string, id: string, withRelated: boolean, json: boolean): void {
  var region = findRegion(rootDir, filePath, id);
  var related = withRelated ? traceJspDependencies(rootDir, region) : [];
  if (json) {
    info(JSON.stringify({ region: region, related: related }, null, 2));
    return;
  }
  printRegion(region, related);
}

export function runJspContext(rootDir: string, filePath: string, id: string, maxTokens: number, json: boolean): void {
  var region = findRegion(rootDir, filePath, id);
  var related = traceJspDependencies(rootDir, region);
  related = related.concat(collectLowPriorityContext(rootDir, region, related));
  var selection = selectJspContext(region, related, maxTokens);
  if (json) {
    info(JSON.stringify({
      filePath: filePath,
      regionId: regionId(region),
      maxTokens: selection.maxTokens,
      tokenEstimate: selection.tokenEstimate,
      selected: selection.selected,
      omitted: selection.omitted
    }, null, 2));
    return;
  }

  info("JSP Context: " + regionId(region));
  info("Budget: " + selection.tokenEstimate + "/" + selection.maxTokens + " tokens");
  info("");
  info("Selected chunks:");
  for (var i = 0; i < selection.selected.length; i++) {
    var selected = selection.selected[i];
    info("- [" + selected.priority + "] " + selected.id + " " + selected.type + " " + selected.filePath + ":" + selected.startLine + "-" + selected.endLine + " (" + selected.mode + ")");
    info("  Reason: " + selected.reason);
  }
  if (selection.omitted.length > 0) {
    info("");
    info("Omitted chunks:");
    for (var o = 0; o < selection.omitted.length; o++) {
      var omitted = selection.omitted[o];
      info("- [" + omitted.priority + "] " + omitted.id + " " + omitted.type + " " + omitted.filePath + ":" + omitted.startLine + "-" + omitted.endLine);
      info("  Reason: " + omitted.reason);
    }
  }
}

export function runJspMap(rootDir: string, filePath: string, json: boolean): void {
  var map = buildJspPageMap(rootDir, filePath);
  if (json) {
    info(JSON.stringify(map, null, 2));
    return;
  }
  info("JSP Page Map: " + map.filePath);
  info("");
  info("Regions: " + map.regions.length);
  for (var i = 0; i < map.regions.length; i++) {
    var region = map.regions[i];
    info("- " + region.id + " [" + region.role + "] " + region.startLine + "-" + region.endLine + (region.name ? " " + region.name : ""));
    if (region.formActions.length > 0) {
      info("  formAction: " + region.formActions.join(", "));
    }
    if (region.ajaxActions.length > 0) {
      info("  ajaxAction: " + region.ajaxActions.join(", "));
    }
    if (region.tableColumns.length > 0) {
      info("  columns: " + region.tableColumns.join(", "));
    }
  }
  info("");
  info("Flows: " + map.flows.length);
  for (var f = 0; f < map.flows.length; f++) {
    var flow = map.flows[f];
    info("- " + flow.name + " (" + flow.kind + ") from=" + (flow.fromRegion || "-") + " event=" + (flow.event || "-") + " action=" + (flow.action || flow.ajaxAction || "-") + " target=" + (flow.targetRegion || flow.resultRegion || flow.refreshRegion || "-"));
  }
}
