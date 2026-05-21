import path = require("path");
import { loadIndex } from "../store/indexStore";
import { CodeChunk, CodeIndex } from "../store/types";
import { toDisplayPath } from "../utils/pathUtils";

export type RelatedPriority = "high" | "medium" | "low";

export interface RelatedChunk {
  chunk: CodeChunk;
  reason: string;
  priority: RelatedPriority;
}

interface EventCall {
  event: string;
  functionName: string;
}

interface AjaxRequest {
  url: string;
  source: string;
}

interface QueueItem {
  functionName: string;
  sourceName: string;
  depth: number;
}

var PRIORITY_WEIGHT: { [key: string]: number } = {
  high: 0,
  medium: 1,
  low: 2
};

var CALL_EXCLUDES: { [key: string]: boolean } = {
  "if": true,
  "for": true,
  "while": true,
  "switch": true,
  "catch": true,
  "function": true,
  "return": true,
  "typeof": true,
  "new": true,
  "alert": true,
  "confirm": true,
  "parseInt": true,
  "parseFloat": true,
  "String": true,
  "Number": true,
  "Boolean": true,
  "Date": true,
  "setTimeout": true,
  "setInterval": true,
  "clearTimeout": true,
  "clearInterval": true,
  "ajax": true,
  "post": true,
  "get": true,
  "fetch": true,
  "open": true
};

function unique(values: string[]): string[] {
  var seen: { [key: string]: boolean } = {};
  var result: string[] = [];
  for (var i = 0; i < values.length; i++) {
    var value = values[i];
    if (!value) {
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

function sameText(a: string | undefined, b: string): boolean {
  return (a || "").toLowerCase() === b.toLowerCase();
}

function contains(values: string[] | undefined, target: string): boolean {
  if (!values) {
    return false;
  }
  for (var i = 0; i < values.length; i++) {
    if (sameText(values[i], target)) {
      return true;
    }
  }
  return false;
}

function normalizeUrl(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/\$\{[^}]+\}/g, "")
    .replace(/<%=[\s\S]*?%>/g, "")
    .replace(/^\s+|\s+$/g, "");
}

function urlKey(value: string): string {
  var clean = normalizeUrl(value).split("?")[0].replace(/^\.\//, "");
  clean = clean.replace(/^https?:\/\/[^/]+/i, "");
  clean = clean.replace(/^[^/]*\$\{[^}]+\}/, "");
  if (clean.charAt(0) !== "/" && /\.(do|action|jsp|html)$/i.test(clean)) {
    clean = "/" + clean;
  }
  return clean.toLowerCase();
}

function addRelated(
  map: { [id: string]: RelatedChunk },
  chunk: CodeChunk,
  reason: string,
  priority: RelatedPriority
): void {
  var existing = map[chunk.id];
  if (!existing || PRIORITY_WEIGHT[priority] < PRIORITY_WEIGHT[existing.priority]) {
    map[chunk.id] = { chunk: chunk, reason: reason, priority: priority };
    return;
  }
  if (existing.reason.indexOf(reason) === -1) {
    existing.reason = existing.reason + "；" + reason;
  }
}

function extractInvokedFunctions(script: string): string[] {
  var result: string[] = [];
  var regex = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  var match: RegExpExecArray | null;
  while ((match = regex.exec(script)) !== null) {
    var name = match[1];
    var before = script.slice(Math.max(0, match.index - 24), match.index);
    if (/\bfunction\s*$/.test(before)) {
      continue;
    }
    if (!CALL_EXCLUDES[name]) {
      result.push(name);
    }
  }
  return unique(result);
}

function extractEventCalls(content: string): EventCall[] {
  var result: EventCall[] = [];
  var attrRegex = /\b(on[A-Za-z]+)\s*=\s*(["'])([\s\S]*?)\2/g;
  var match: RegExpExecArray | null;
  while ((match = attrRegex.exec(content)) !== null) {
    var functions = extractInvokedFunctions(match[3]);
    for (var i = 0; i < functions.length; i++) {
      result.push({ event: match[1].toLowerCase(), functionName: functions[i] });
    }
  }

  var hrefRegex = /\bhref\s*=\s*(["'])\s*javascript\s*:\s*([\s\S]*?)\1/gi;
  while ((match = hrefRegex.exec(content)) !== null) {
    var hrefFunctions = extractInvokedFunctions(match[2]);
    for (var h = 0; h < hrefFunctions.length; h++) {
      result.push({ event: "href", functionName: hrefFunctions[h] });
    }
  }

  return result;
}

function functionDefRegex(name: string): RegExp {
  var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    "(?:function\\s+" + escaped + "\\s*\\(|(?:var|let|const)\\s+" + escaped + "\\s*=\\s*function\\s*\\(|" + escaped + "\\s*:\\s*function\\s*\\()"
  );
}

function isFunctionChunk(chunk: CodeChunk, name: string): boolean {
  if (chunk.type === "jsp-script-function") {
    return sameText(chunk.name, name);
  }
  if (sameText(chunk.name, name) || contains(chunk.symbols, name)) {
    return true;
  }
  if (chunk.metadata && contains(chunk.metadata.jsFunctions, name)) {
    return true;
  }
  return functionDefRegex(name).test(chunk.content);
}

function likelyJsCarrier(chunk: CodeChunk, primary: CodeChunk): boolean {
  if (chunk.filePath === primary.filePath && chunk.type.indexOf("jsp-script") === 0) {
    return true;
  }
  if (/\.(js|jsp)$/i.test(chunk.filePath)) {
    return true;
  }
  return chunk.language === "js" || chunk.language === "jsp";
}

function findFunctionChunks(index: CodeIndex, primary: CodeChunk, name: string): CodeChunk[] {
  var result: CodeChunk[] = [];
  for (var i = 0; i < index.chunks.length; i++) {
    var chunk = index.chunks[i];
    if (chunk.id === primary.id || !likelyJsCarrier(chunk, primary)) {
      continue;
    }
    if (isFunctionChunk(chunk, name)) {
      result.push(chunk);
    }
  }
  return result;
}

function extractAjaxRequests(content: string): AjaxRequest[] {
  var result: AjaxRequest[] = [];
  var ajaxRegex = /\$\.ajax\s*\(\s*\{[\s\S]*?\burl\s*:\s*(["'])(.*?)\1/gi;
  var ajaxMatch: RegExpExecArray | null;
  while ((ajaxMatch = ajaxRegex.exec(content)) !== null) {
    result.push({ url: normalizeUrl(ajaxMatch[2]), source: "$.ajax" });
  }

  var callRegex = /\$\.(post|get)\s*\(\s*(["'])(.*?)\2/gi;
  var match: RegExpExecArray | null;
  while ((match = callRegex.exec(content)) !== null) {
    result.push({ url: normalizeUrl(match[3]), source: "$." + match[1].toLowerCase() });
  }

  var fetchRegex = /\bfetch\s*\(\s*(["'])(.*?)\1/gi;
  while ((match = fetchRegex.exec(content)) !== null) {
    result.push({ url: normalizeUrl(match[2]), source: "fetch" });
  }

  var xhrRegex = /\.open\s*\(\s*(["'])(?:GET|POST|PUT|DELETE|PATCH)\1\s*,\s*(["'])(.*?)\2/gi;
  while ((match = xhrRegex.exec(content)) !== null) {
    result.push({ url: normalizeUrl(match[3]), source: "XMLHttpRequest" });
  }

  var customRegex = /\b([A-Za-z_$][A-Za-z0-9_$.]*(?:ajax|Ajax|request|Request|post|Post|get|Get)[A-Za-z0-9_$]*)\s*\(\s*(["'])(.*?)\2/g;
  while ((match = customRegex.exec(content)) !== null) {
    if (/^(alert|confirm)$/i.test(match[1])) {
      continue;
    }
    result.push({ url: normalizeUrl(match[3]), source: match[1] });
  }

  return result.filter(function (request) {
    return request.url.length > 0 && (/^\//.test(request.url) || /\.(do|action|jsp|html)(?:\?|$)/i.test(request.url));
  });
}

function pathLooksLikeSameFile(link: string, filePath: string): boolean {
  var normalizedLink = toDisplayPath(link).replace(/^\.\//, "").replace(/^\//, "").toLowerCase();
  var normalizedFile = toDisplayPath(filePath).toLowerCase();
  return normalizedFile === normalizedLink || normalizedFile.indexOf("/" + normalizedLink) !== -1;
}

function findLinkedFileChunks(index: CodeIndex, link: string, primary: CodeChunk): CodeChunk[] {
  var result: CodeChunk[] = [];
  for (var i = 0; i < index.chunks.length; i++) {
    var chunk = index.chunks[i];
    if (chunk.id !== primary.id && pathLooksLikeSameFile(link, chunk.filePath)) {
      result.push(chunk);
    }
  }
  return result;
}

function actionMatchesChunk(action: string, chunk: CodeChunk): boolean {
  var key = urlKey(action);
  if (!key) {
    return false;
  }
  if (chunk.type === "xml-struts-action") {
    if (urlKey(chunk.name || "") === key || urlKey((chunk.name || "") + ".do") === key) {
      return true;
    }
    for (var i = 0; i < chunk.links.length; i++) {
      if (urlKey(chunk.links[i]) === key) {
        return true;
      }
    }
  }
  if (chunk.language === "java") {
    if (chunk.content.toLowerCase().indexOf(key) !== -1 || chunk.content.toLowerCase().indexOf(key.replace(/^\//, "")) !== -1) {
      return true;
    }
    var tail = path.basename(key).replace(/\.(do|action)$/i, "");
    if (tail && (contains(chunk.symbols, tail) || sameText(chunk.name, tail))) {
      return true;
    }
  }
  return false;
}

function findActionChunks(index: CodeIndex, action: string, primary: CodeChunk): CodeChunk[] {
  var result: CodeChunk[] = [];
  for (var i = 0; i < index.chunks.length; i++) {
    var chunk = index.chunks[i];
    if (chunk.id === primary.id) {
      continue;
    }
    if ((chunk.language === "xml" || chunk.language === "java") && actionMatchesChunk(action, chunk)) {
      result.push(chunk);
    }
  }
  return result;
}

function linkedValues(primary: CodeChunk, key: "includePaths" | "externalJs" | "externalCss" | "formActions"): string[] {
  if (!primary.metadata) {
    return [];
  }
  return primary.metadata[key] || [];
}

function priorityRank(item: RelatedChunk): number {
  return PRIORITY_WEIGHT[item.priority];
}

export function traceJspDependencies(rootDir: string, primary: CodeChunk): RelatedChunk[] {
  var index = loadIndex(rootDir);
  var related: { [id: string]: RelatedChunk } = {};
  var queue: QueueItem[] = [];
  var visitedFunctions: { [key: string]: boolean } = {};

  var eventCalls = extractEventCalls(primary.content);
  var metadataEvents = primary.metadata ? primary.metadata.events || [] : [];
  for (var e = 0; e < metadataEvents.length; e++) {
    var alreadyFound = false;
    for (var existingEvent = 0; existingEvent < eventCalls.length; existingEvent++) {
      if (sameText(eventCalls[existingEvent].functionName, metadataEvents[e])) {
        alreadyFound = true;
        break;
      }
    }
    if (!alreadyFound) {
      eventCalls.push({ event: "event", functionName: metadataEvents[e] });
    }
  }

  for (var c = 0; c < eventCalls.length; c++) {
    var eventCall = eventCalls[c];
    queue.push({ functionName: eventCall.functionName, sourceName: eventCall.event, depth: 0 });
    var handlers = findFunctionChunks(index, primary, eventCall.functionName);
    for (var h = 0; h < handlers.length; h++) {
      addRelated(related, handlers[h], eventCall.event + " 调用了 " + eventCall.functionName, "high");
    }
  }

  var formActions = linkedValues(primary, "formActions");
  for (var a = 0; a < formActions.length; a++) {
    var actionChunks = findActionChunks(index, formActions[a], primary);
    for (var ac = 0; ac < actionChunks.length; ac++) {
      addRelated(related, actionChunks[ac], "form action 指向 " + formActions[a], "high");
    }
  }

  var directAjax = extractAjaxRequests(primary.content);
  for (var da = 0; da < directAjax.length; da++) {
    var directTargets = findActionChunks(index, directAjax[da].url, primary);
    for (var dt = 0; dt < directTargets.length; dt++) {
      addRelated(related, directTargets[dt], directAjax[da].source + " 请求了 " + directAjax[da].url, "high");
    }
  }

  var includes = linkedValues(primary, "includePaths");
  for (var inc = 0; inc < includes.length; inc++) {
    var includeChunks = findLinkedFileChunks(index, includes[inc], primary);
    for (var ic = 0; ic < includeChunks.length; ic++) {
      addRelated(related, includeChunks[ic], "JSP include 引用了 " + includes[inc], "medium");
    }
  }

  var assets = linkedValues(primary, "externalJs").concat(linkedValues(primary, "externalCss"));
  for (var as = 0; as < assets.length; as++) {
    var assetChunks = findLinkedFileChunks(index, assets[as], primary);
    for (var asc = 0; asc < assetChunks.length; asc++) {
      addRelated(related, assetChunks[asc], "外部资源引用了 " + assets[as], "low");
    }
  }

  while (queue.length > 0) {
    var item = queue.shift() as QueueItem;
    var visitKey = item.functionName.toLowerCase() + ":" + item.depth;
    if (visitedFunctions[visitKey] || item.depth > 3) {
      continue;
    }
    visitedFunctions[visitKey] = true;
    var functionChunks = findFunctionChunks(index, primary, item.functionName);
    for (var fc = 0; fc < functionChunks.length; fc++) {
      var functionChunk = functionChunks[fc];
      var ajaxRequests = extractAjaxRequests(functionChunk.content);
      for (var ar = 0; ar < ajaxRequests.length; ar++) {
        var targets = findActionChunks(index, ajaxRequests[ar].url, primary);
        for (var t = 0; t < targets.length; t++) {
          addRelated(related, targets[t], item.functionName + " 请求了 " + ajaxRequests[ar].url, "high");
        }
      }

      var calls = extractInvokedFunctions(functionChunk.content);
      for (var call = 0; call < calls.length; call++) {
        if (sameText(calls[call], item.functionName)) {
          continue;
        }
        var nextChunks = findFunctionChunks(index, primary, calls[call]);
        for (var nc = 0; nc < nextChunks.length; nc++) {
          addRelated(related, nextChunks[nc], item.functionName + " 调用了 " + calls[call], item.depth <= 1 ? "high" : "medium");
        }
        if (nextChunks.length > 0) {
          queue.push({ functionName: calls[call], sourceName: item.functionName, depth: item.depth + 1 });
        }
      }
    }
  }

  var result: RelatedChunk[] = [];
  for (var id in related) {
    if (Object.prototype.hasOwnProperty.call(related, id)) {
      result.push(related[id]);
    }
  }
  result.sort(function (a, b) {
    if (priorityRank(a) !== priorityRank(b)) {
      return priorityRank(a) - priorityRank(b);
    }
    if (a.chunk.filePath !== b.chunk.filePath) {
      return a.chunk.filePath < b.chunk.filePath ? -1 : 1;
    }
    return a.chunk.startLine - b.chunk.startLine;
  });
  return result;
}
