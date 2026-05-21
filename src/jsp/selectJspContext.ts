import { RelatedChunk } from "./traceJspDependencies";
import { CodeChunk } from "../store/types";
import { estimateTokens } from "../utils/tokenEstimate";

export type JspContextPriority = "required" | "high" | "medium" | "low";

export interface SelectedJspContextChunk {
  id: string;
  filePath: string;
  type: string;
  name?: string;
  startLine: number;
  endLine: number;
  priority: JspContextPriority;
  reason: string;
  mode: "full" | "summary" | "snippet";
  tokenEstimate: number;
  summary?: string;
  content: string;
}

export interface OmittedJspContextChunk {
  id: string;
  filePath: string;
  type: string;
  name?: string;
  startLine: number;
  endLine: number;
  priority: JspContextPriority;
  reason: string;
  tokenEstimate: number;
}

export interface JspContextSelection {
  maxTokens: number;
  tokenEstimate: number;
  selected: SelectedJspContextChunk[];
  omitted: OmittedJspContextChunk[];
}

interface Candidate {
  chunk: CodeChunk;
  priority: JspContextPriority;
  reason: string;
  order: number;
}

var PRIORITY_RANK: { [key: string]: number } = {
  required: 0,
  high: 1,
  medium: 2,
  low: 3
};

function lower(value: string): string {
  return value.toLowerCase();
}

function uniqueCandidates(candidates: Candidate[]): Candidate[] {
  var seen: { [id: string]: Candidate } = {};
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    var existing = seen[candidate.chunk.id];
    if (!existing || PRIORITY_RANK[candidate.priority] < PRIORITY_RANK[existing.priority]) {
      seen[candidate.chunk.id] = candidate;
    }
  }

  var result: Candidate[] = [];
  for (var id in seen) {
    if (Object.prototype.hasOwnProperty.call(seen, id)) {
      result.push(seen[id]);
    }
  }
  result.sort(function (a, b) {
    if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) {
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }
    return a.order - b.order;
  });
  return result;
}

function classifyRelated(item: RelatedChunk): JspContextPriority {
  var reason = lower(item.reason || "");
  var chunk = item.chunk;
  if (reason.indexOf("include") >= 0 || chunk.type === "jsp-include") {
    return "high";
  }
  if (chunk.type === "jsp-script-function" && item.priority === "high") {
    return "high";
  }
  if (chunk.type === "xml-struts-action" || chunk.type === "java-method" || chunk.type === "java-class") {
    return "medium";
  }
  if (item.priority === "high") {
    return "high";
  }
  if (item.priority === "medium") {
    return "medium";
  }
  return "low";
}

function firstLine(content: string): string {
  var lines = content.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].replace(/^\s+|\s+$/g, "").length > 0) {
      return lines[i];
    }
  }
  return "";
}

function buildSummary(chunk: CodeChunk, reason: string): string {
  var parts = [];
  if (chunk.name) {
    parts.push("name=" + chunk.name);
  }
  if (chunk.summary) {
    parts.push(chunk.summary);
  }
  parts.push(reason);
  return parts.join("; ");
}

function compactFunction(chunk: CodeChunk, reason: string, priority: JspContextPriority): SelectedJspContextChunk {
  var signature = firstLine(chunk.content);
  var content = signature + "\n/* omitted long function body: " + buildSummary(chunk, reason) + " */";
  return selectedFrom(chunk, "summary", content, reason, priority, buildSummary(chunk, reason));
}

function keywordRegex(chunk: CodeChunk): RegExp | undefined {
  var values = (chunk.links || []).concat(chunk.keywords || []).concat(chunk.symbols || []);
  var escaped: string[] = [];
  for (var i = 0; i < values.length && escaped.length < 8; i++) {
    var value = values[i];
    if (value && value.length >= 2) {
      escaped.push(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }
  }
  if (escaped.length === 0) {
    return undefined;
  }
  return new RegExp(escaped.join("|"), "i");
}

function compactSnippet(chunk: CodeChunk, reason: string, priority: JspContextPriority): SelectedJspContextChunk {
  var lines = chunk.content.split(/\r?\n/);
  var regex = keywordRegex(chunk);
  var hit = 0;
  if (regex) {
    for (var i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        hit = i;
        break;
      }
    }
  }
  var start = Math.max(0, hit - 4);
  var end = Math.min(lines.length, hit + 5);
  var prefix = start > 0 ? "/* omitted " + start + " lines before */\n" : "";
  var suffix = end < lines.length ? "\n/* omitted " + (lines.length - end) + " lines after */" : "";
  var content = prefix + lines.slice(start, end).join("\n") + suffix;
  return selectedFrom(chunk, "snippet", content, reason, priority, buildSummary(chunk, reason));
}

function selectedFrom(
  chunk: CodeChunk,
  mode: "full" | "summary" | "snippet",
  content: string,
  reason: string,
  priority: JspContextPriority,
  summary?: string
): SelectedJspContextChunk {
  return {
    id: chunk.id,
    filePath: chunk.filePath,
    type: chunk.type,
    name: chunk.name,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    priority: priority,
    reason: reason,
    mode: mode,
    tokenEstimate: estimateTokens(content),
    summary: summary,
    content: content
  };
}

function fullSelected(candidate: Candidate): SelectedJspContextChunk {
  return selectedFrom(candidate.chunk, "full", candidate.chunk.content, candidate.reason, candidate.priority, candidate.chunk.summary);
}

function compactSelected(candidate: Candidate): SelectedJspContextChunk {
  if (candidate.chunk.type === "jsp-script-function" || candidate.chunk.type === "java-method") {
    return compactFunction(candidate.chunk, candidate.reason, candidate.priority);
  }
  if (candidate.chunk.type === "xml-struts-action" || candidate.chunk.language === "java" || candidate.chunk.language === "xml") {
    return compactSnippet(candidate.chunk, candidate.reason, candidate.priority);
  }
  return compactSnippet(candidate.chunk, candidate.reason, candidate.priority);
}

function omittedFrom(candidate: Candidate, reason: string): OmittedJspContextChunk {
  return {
    id: candidate.chunk.id,
    filePath: candidate.chunk.filePath,
    type: candidate.chunk.type,
    name: candidate.chunk.name,
    startLine: candidate.chunk.startLine,
    endLine: candidate.chunk.endLine,
    priority: candidate.priority,
    reason: reason,
    tokenEstimate: estimateTokens(candidate.chunk.content)
  };
}

function estimateOutput(
  maxTokens: number,
  filePath: string,
  regionId: string,
  selected: SelectedJspContextChunk[],
  omitted: OmittedJspContextChunk[]
): number {
  return estimateTokens(JSON.stringify({
    filePath: filePath,
    regionId: regionId,
    maxTokens: maxTokens,
    tokenEstimate: 0,
    selected: selected,
    omitted: omitted
  }));
}

function candidateFromRelated(item: RelatedChunk, order: number): Candidate {
  return {
    chunk: item.chunk,
    priority: classifyRelated(item),
    reason: item.reason,
    order: order
  };
}

function getRegionId(primary: CodeChunk): string {
  return primary.metadata && primary.metadata.regionId ? primary.metadata.regionId : primary.id;
}

function forceFitRequired(primary: CodeChunk, maxTokens: number, omitted: OmittedJspContextChunk[]): SelectedJspContextChunk {
  var lines = primary.content.split(/\r?\n/);
  var keep = Math.min(lines.length, 20);
  while (keep > 1) {
    var content = lines.slice(0, keep).join("\n");
    if (keep < lines.length) {
      content += "\n/* omitted " + (lines.length - keep) + " lines from required region to fit maxTokens */";
    }
    var selected = selectedFrom(primary, "snippet", content, "current JSP region is required; content was reduced to fit maxTokens", "required", primary.summary);
    if (estimateOutput(maxTokens, primary.filePath, getRegionId(primary), [selected], omitted) <= maxTokens) {
      return selected;
    }
    keep--;
  }
  return selectedFrom(primary, "snippet", firstLine(primary.content), "current JSP region is required; only the first line fits maxTokens", "required", primary.summary);
}

export function selectJspContext(primary: CodeChunk, related: RelatedChunk[], maxTokens: number): JspContextSelection {
  var regionId = getRegionId(primary);
  var candidates: Candidate[] = [{
    chunk: primary,
    priority: "required",
    reason: "current JSP region is required",
    order: 0
  }];

  for (var i = 0; i < related.length; i++) {
    candidates.push(candidateFromRelated(related[i], i + 1));
  }

  candidates = uniqueCandidates(candidates);

  var selected: SelectedJspContextChunk[] = [];
  var omitted: OmittedJspContextChunk[] = [];

  for (var c = 0; c < candidates.length; c++) {
    var candidate = candidates[c];
    var item = fullSelected(candidate);
    selected.push(item);
    if (estimateOutput(maxTokens, primary.filePath, regionId, selected, omitted) <= maxTokens) {
      continue;
    }

    selected.pop();
    if (candidate.priority === "required") {
      var compactRequired = compactSnippet(candidate.chunk, candidate.reason, candidate.priority);
      selected.push(compactRequired);
      if (estimateOutput(maxTokens, primary.filePath, regionId, selected, omitted) > maxTokens) {
        selected.pop();
        selected.push(forceFitRequired(candidate.chunk, maxTokens, omitted));
      }
      continue;
    }

    var compact = compactSelected(candidate);
    selected.push(compact);
    if (estimateOutput(maxTokens, primary.filePath, regionId, selected, omitted) <= maxTokens) {
      continue;
    }

    selected.pop();
    omitted.push(omittedFrom(candidate, "omitted because token budget was exhausted before this " + candidate.priority + " priority chunk"));
  }

  while (estimateOutput(maxTokens, primary.filePath, regionId, selected, omitted) > maxTokens && selected.length > 1) {
    var removed = selected.pop() as SelectedJspContextChunk;
    omitted.push({
      id: removed.id,
      filePath: removed.filePath,
      type: removed.type,
      name: removed.name,
      startLine: removed.startLine,
      endLine: removed.endLine,
      priority: removed.priority,
      reason: "removed during final budget enforcement",
      tokenEstimate: removed.tokenEstimate
    });
  }

  while (estimateOutput(maxTokens, primary.filePath, regionId, selected, omitted) > maxTokens && omitted.length > 0) {
    omitted.pop();
  }

  if (estimateOutput(maxTokens, primary.filePath, regionId, selected, omitted) > maxTokens && selected.length === 1) {
    selected[0] = forceFitRequired(primary, maxTokens, []);
    omitted = [];
  }

  var tokenEstimate = estimateOutput(maxTokens, primary.filePath, regionId, selected, omitted);
  return {
    maxTokens: maxTokens,
    tokenEstimate: tokenEstimate,
    selected: selected,
    omitted: omitted
  };
}
