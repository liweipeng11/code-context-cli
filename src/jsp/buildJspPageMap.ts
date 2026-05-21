import fs = require("fs");
import path = require("path");
import { JspRegion, parseJspRegions } from "../chunker/jspRegionParser";
import { toRelativeDisplayPath } from "../utils/pathUtils";

export interface JspPageMapRegion {
  id: string;
  type: string;
  role: string;
  name?: string;
  summary: string;
  startLine: number;
  endLine: number;
  parentRegionId?: string;
  domIds: string[];
  fields: string[];
  buttons: string[];
  tableColumns: string[];
  formActions: string[];
  ajaxActions: string[];
  events: string[];
  jsFunctions: string[];
  includes: string[];
  dependencies: string[];
}

export interface JspPageMapFlow {
  name: string;
  kind: string;
  fromRegion?: string;
  event?: string;
  action?: string;
  ajaxAction?: string;
  targetRegion?: string;
  resultRegion?: string;
  saveAction?: string;
  refreshRegion?: string;
  confidence: "high" | "medium" | "low";
}

export interface JspPageMap {
  filePath: string;
  pageIncludes: string[];
  externalDependencies: {
    js: string[];
    css: string[];
  };
  forms: Array<{ regionId: string; actions: string[]; fields: string[] }>;
  ajaxActions: Array<{ action: string; method?: string; event?: string; regionId?: string }>;
  tableFields: Array<{ regionId: string; columns: string[] }>;
  dialogs: Array<{ regionId: string; name?: string; openedBy: string[]; saveActions: string[] }>;
  regions: JspPageMapRegion[];
  flows: JspPageMapFlow[];
}

interface AjaxAction {
  action: string;
  method?: string;
  event?: string;
  regionId?: string;
}

function unique(values: string[]): string[] {
  var seen: { [key: string]: boolean } = {};
  var result: string[] = [];
  for (var i = 0; i < values.length; i++) {
    var value = (values[i] || "").trim();
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

function collect(content: string, regex: RegExp): string[] {
  var result: string[] = [];
  var match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    result.push(match[1] || match[0]);
  }
  return unique(result);
}

function first<T>(values: T[]): T | undefined {
  return values.length > 0 ? values[0] : undefined;
}

function resolveJspPath(rootDir: string, filePath: string): string {
  var direct = path.isAbsolute(filePath) ? filePath : path.resolve(rootDir, filePath);
  if (fs.existsSync(direct)) {
    return direct;
  }
  var normalized = filePath.split("/").join(path.sep);
  var fromRoot = path.resolve(rootDir, normalized);
  if (fs.existsSync(fromRoot)) {
    return fromRoot;
  }
  throw new Error("JSP file not found: " + filePath);
}

function inferRole(region: JspRegion): string {
  var type = region.type;
  var marker = ((region.name || "") + " " + region.id + " " + region.summary + " " + region.metadata.buttons.join(" ") + " " + region.metadata.jsFunctions.join(" ")).toLowerCase();
  if (type === "jsp-include" || type === "jsp-directive") {
    return "include";
  }
  if (type === "jsp-assets") {
    return "dependency";
  }
  if (type === "jsp-dialog") {
    if (/(add|new|create|新增|添加)/i.test(marker)) {
      return "create-dialog";
    }
    if (/(edit|modify|update|编辑|修改)/i.test(marker)) {
      return "edit-dialog";
    }
    return "dialog";
  }
  if (type === "jsp-result-list" || type === "jsp-table") {
    return "result-table";
  }
  if (type === "jsp-form") {
    if (/(edit|save|新增|添加|编辑|保存)/i.test(marker)) {
      return "edit-form";
    }
    if (/(query|search|filter|find|查询|搜索|检索)/i.test(marker)) {
      return "query-form";
    }
    return "form";
  }
  if (type === "jsp-toolbar" || type === "jsp-button-group") {
    return "actions";
  }
  if (type === "jsp-pagination") {
    return "pagination";
  }
  if (type === "jsp-script-function") {
    return "script-function";
  }
  return "content";
}

function actionVerb(value: string): string {
  var text = value.toLowerCase();
  if (/(query|search|list|find|page|load|select)/.test(text)) {
    return "query";
  }
  if (/(add|new|create|insert)/.test(text)) {
    return "create";
  }
  if (/(edit|modify|update|detail|get)/.test(text)) {
    return "edit";
  }
  if (/(delete|remove|del)/.test(text)) {
    return "delete";
  }
  if (/(save|submit|commit)/.test(text)) {
    return "save";
  }
  if (/(refresh|reload)/.test(text)) {
    return "refresh";
  }
  return "action";
}

function eventVerb(value: string): string {
  var text = value.toLowerCase();
  if (/(query|search|find|load|list|查询|搜索|检索)/i.test(text)) {
    return "query";
  }
  if (/(add|new|create|insert|新增|添加)/i.test(text)) {
    return "create";
  }
  if (/(edit|modify|update|openedit|编辑|修改)/i.test(text)) {
    return "edit";
  }
  if (/(delete|remove|del|删除)/i.test(text)) {
    return "delete";
  }
  if (/(save|submit|commit|保存|提交)/i.test(text)) {
    return "save";
  }
  if (/(refresh|reload|刷新|重载)/i.test(text)) {
    return "refresh";
  }
  return "action";
}

function flowName(kind: string): string {
  if (kind === "query") {
    return "查询";
  }
  if (kind === "create") {
    return "新增";
  }
  if (kind === "edit") {
    return "编辑";
  }
  if (kind === "delete") {
    return "删除";
  }
  if (kind === "save") {
    return "保存";
  }
  if (kind === "refresh") {
    return "刷新";
  }
  return "操作";
}

function extractAjaxActions(content: string): AjaxAction[] {
  var result: AjaxAction[] = [];
  var match: RegExpExecArray | null;
  var ajaxBlock = /\$\.ajax\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
  while ((match = ajaxBlock.exec(content)) !== null) {
    var block = match[1];
    var url = /\burl\s*:\s*["']([^"']+)["']/i.exec(block);
    var method = /\b(?:type|method)\s*:\s*["']([^"']+)["']/i.exec(block);
    if (url) {
      result.push({ action: url[1], method: method ? method[1].toUpperCase() : undefined });
    }
  }

  var callRegex = /\$\.(get|post|getJSON)\s*\(\s*["']([^"']+)["']/gi;
  while ((match = callRegex.exec(content)) !== null) {
    result.push({ action: match[2], method: match[1].toUpperCase() });
  }

  var fetchRegex = /\bfetch\s*\(\s*["']([^"']+)["']/gi;
  while ((match = fetchRegex.exec(content)) !== null) {
    result.push({ action: match[1] });
  }

  var axiosRegex = /\baxios\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/gi;
  while ((match = axiosRegex.exec(content)) !== null) {
    result.push({ action: match[2], method: match[1].toUpperCase() });
  }

  return dedupeAjax(result);
}

function dedupeAjax(actions: AjaxAction[]): AjaxAction[] {
  var seen: { [key: string]: boolean } = {};
  var result: AjaxAction[] = [];
  for (var i = 0; i < actions.length; i++) {
    var item = actions[i];
    var key = item.action + "|" + (item.method || "") + "|" + (item.event || "") + "|" + (item.regionId || "");
    if (!seen[key]) {
      seen[key] = true;
      result.push(item);
    }
  }
  return result;
}

function findResultRegion(regions: JspRegion[]): JspRegion | undefined {
  for (var i = 0; i < regions.length; i++) {
    if (inferRole(regions[i]) === "result-table") {
      return regions[i];
    }
  }
  return undefined;
}

function findQueryRegion(regions: JspRegion[]): JspRegion | undefined {
  for (var i = 0; i < regions.length; i++) {
    if (inferRole(regions[i]) === "query-form") {
      return regions[i];
    }
  }
  for (var n = 0; n < regions.length; n++) {
    if (regions[n].type === "jsp-form") {
      return regions[n];
    }
  }
  return undefined;
}

function findDialog(regions: JspRegion[], kind?: string): JspRegion | undefined {
  for (var i = 0; i < regions.length; i++) {
    var role = inferRole(regions[i]);
    if (kind && role === kind + "-dialog") {
      return regions[i];
    }
    if (!kind && role.indexOf("dialog") >= 0) {
      return regions[i];
    }
  }
  return undefined;
}

function regionMentionsEvent(region: JspRegion, event: string): boolean {
  if (region.metadata.events.indexOf(event) >= 0 || region.metadata.jsFunctions.indexOf(event) >= 0) {
    return true;
  }
  return region.content.indexOf(event) >= 0;
}

function findFromRegion(regions: JspRegion[], event: string, kind: string): JspRegion | undefined {
  var preferredRole = kind === "query" ? "query-form" : kind === "save" ? "edit-form" : kind === "edit" || kind === "delete" ? "result-table" : "";
  for (var i = 0; i < regions.length; i++) {
    if (preferredRole && inferRole(regions[i]) === preferredRole && regionMentionsEvent(regions[i], event)) {
      return regions[i];
    }
  }
  for (var n = 0; n < regions.length; n++) {
    if (regionMentionsEvent(regions[n], event) && regions[n].type !== "jsp-script-function") {
      return regions[n];
    }
  }
  if (kind === "query") {
    return findQueryRegion(regions);
  }
  if (kind === "edit" || kind === "delete") {
    return findResultRegion(regions);
  }
  return undefined;
}

function mapRegion(region: JspRegion): JspPageMapRegion {
  var ajaxActions = extractAjaxActions(region.content);
  var deps = region.metadata.externalJs.concat(region.metadata.externalCss);
  return {
    id: region.id,
    type: region.type,
    role: inferRole(region),
    name: region.name,
    summary: region.summary,
    startLine: region.startLine,
    endLine: region.endLine,
    parentRegionId: region.metadata.parentRegionId,
    domIds: region.metadata.domIds,
    fields: region.metadata.fields,
    buttons: region.metadata.buttons,
    tableColumns: region.metadata.tableColumns,
    formActions: region.metadata.formActions,
    ajaxActions: ajaxActions.map(function (item) { return item.action; }),
    events: region.metadata.events,
    jsFunctions: region.metadata.jsFunctions,
    includes: region.metadata.includePaths,
    dependencies: deps
  };
}

function buildFlows(regions: JspRegion[], ajaxActions: AjaxAction[]): JspPageMapFlow[] {
  var flows: JspPageMapFlow[] = [];
  var resultRegion = findResultRegion(regions);
  var queryRegion = findQueryRegion(regions);

  for (var i = 0; i < regions.length; i++) {
    var region = regions[i];
    for (var f = 0; f < region.metadata.formActions.length; f++) {
      var action = region.metadata.formActions[f];
      if (region.metadata.parentRegionId && parentHasFormAction(regions, region.metadata.parentRegionId, action)) {
        continue;
      }
      var kind = actionVerb(action);
      flows.push({
        name: flowName(kind),
        kind: kind,
        fromRegion: region.id,
        action: action,
        resultRegion: kind === "query" && resultRegion ? resultRegion.id : undefined,
        refreshRegion: kind === "save" && resultRegion ? resultRegion.id : undefined,
        confidence: kind === "action" ? "medium" : "high"
      });
    }
  }

  for (var a = 0; a < ajaxActions.length; a++) {
    var ajax = ajaxActions[a];
    var event = ajax.event || "";
    var kind = event ? eventVerb(event) : actionVerb(ajax.action);
    var from = event ? findFromRegion(regions, event, kind) : undefined;
    var editDialog = kind === "edit" || kind === "create" ? findDialog(regions, kind === "create" ? "create" : "edit") || findDialog(regions) : undefined;
    flows.push({
      name: flowName(kind),
      kind: kind,
      fromRegion: from ? from.id : ajax.regionId,
      event: event || undefined,
      ajaxAction: ajax.action,
      targetRegion: editDialog ? editDialog.id : undefined,
      resultRegion: kind === "query" && resultRegion ? resultRegion.id : undefined,
      refreshRegion: (kind === "save" || kind === "delete" || kind === "refresh") && resultRegion ? resultRegion.id : undefined,
      confidence: event ? "high" : "medium"
    });
  }

  var allEvents: string[] = [];
  for (var r = 0; r < regions.length; r++) {
    allEvents = allEvents.concat(regions[r].metadata.events).concat(regions[r].metadata.jsFunctions);
  }
  allEvents = unique(allEvents);
  for (var e = 0; e < allEvents.length; e++) {
    var eventName = allEvents[e];
    var eventKind = eventVerb(eventName);
    if (eventKind === "action") {
      continue;
    }
    var duplicate = false;
    for (var d = 0; d < flows.length; d++) {
      if (flows[d].event === eventName || flows[d].kind === eventKind) {
        duplicate = true;
        break;
      }
    }
    if (duplicate) {
      continue;
    }
    var source = findFromRegion(regions, eventName, eventKind);
    var dialog = eventKind === "edit" || eventKind === "create" ? findDialog(regions, eventKind === "create" ? "create" : "edit") || findDialog(regions) : undefined;
    flows.push({
      name: flowName(eventKind),
      kind: eventKind,
      fromRegion: source ? source.id : undefined,
      event: eventName,
      targetRegion: dialog ? dialog.id : undefined,
      resultRegion: eventKind === "query" && resultRegion ? resultRegion.id : undefined,
      refreshRegion: (eventKind === "save" || eventKind === "delete" || eventKind === "refresh") && resultRegion ? resultRegion.id : undefined,
      confidence: "low"
    });
  }

  if (queryRegion && resultRegion) {
    var hasQuery = false;
    for (var q = 0; q < flows.length; q++) {
      if (flows[q].kind === "query") {
        hasQuery = true;
      }
    }
    if (!hasQuery) {
      flows.unshift({
        name: "查询",
        kind: "query",
        fromRegion: queryRegion.id,
        resultRegion: resultRegion.id,
        confidence: "low"
      });
    }
  }

  return flows;
}

function parentHasFormAction(regions: JspRegion[], parentRegionId: string, action: string): boolean {
  for (var i = 0; i < regions.length; i++) {
    var region = regions[i];
    if (region.id === parentRegionId && region.metadata.formActions.indexOf(action) >= 0) {
      return true;
    }
  }
  return false;
}

function attachAjaxToRegions(regions: JspRegion[]): AjaxAction[] {
  var result: AjaxAction[] = [];
  for (var i = 0; i < regions.length; i++) {
    var region = regions[i];
    var actions = extractAjaxActions(region.content);
    for (var a = 0; a < actions.length; a++) {
      actions[a].regionId = region.id;
      actions[a].event = first(region.metadata.jsFunctions) || first(region.metadata.events);
      result.push(actions[a]);
    }
  }
  return dedupeAjax(result);
}

export function buildJspPageMap(rootDir: string, filePath: string): JspPageMap {
  var absolutePath = resolveJspPath(rootDir, filePath);
  var content = fs.readFileSync(absolutePath, "utf8");
  var regions = parseJspRegions(content);
  var displayPath = toRelativeDisplayPath(rootDir, absolutePath);
  var ajaxActions = attachAjaxToRegions(regions);
  var pageIncludes = unique(collect(content, /<%@\s*include[^%]+\bfile\s*=\s*["']([^"']+)["']/gi)
    .concat(collect(content, /<jsp:include[^>]+\bpage\s*=\s*["']([^"']+)["']/gi)));
  var externalJs = unique(collect(content, /<script[^>]+\bsrc\s*=\s*["']([^"']+)["']/gi));
  var externalCss = unique(collect(content, /<link[^>]+\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi));

  return {
    filePath: displayPath,
    pageIncludes: pageIncludes,
    externalDependencies: {
      js: externalJs,
      css: externalCss
    },
    forms: regions.filter(function (region) { return region.metadata.formActions.length > 0 || region.type === "jsp-form" || region.type === "jsp-hidden-form"; })
      .map(function (region) {
        return { regionId: region.id, actions: region.metadata.formActions, fields: region.metadata.fields };
      }),
    ajaxActions: ajaxActions,
    tableFields: regions.filter(function (region) { return region.metadata.tableColumns.length > 0; })
      .map(function (region) {
        return { regionId: region.id, columns: region.metadata.tableColumns };
      }),
    dialogs: regions.filter(function (region) { return inferRole(region).indexOf("dialog") >= 0; })
      .map(function (region) {
        var openedBy: string[] = [];
        for (var i = 0; i < regions.length; i++) {
          var other = regions[i];
          var events = other.metadata.events.concat(other.metadata.jsFunctions).concat(other.metadata.buttons);
          var joined = events.join(" ").toLowerCase();
          var name = (region.name || region.id).toLowerCase();
          if (joined.indexOf("dialog") >= 0 || joined.indexOf("edit") >= 0 || joined.indexOf("add") >= 0 || joined.indexOf(name) >= 0) {
            openedBy.push(other.id);
          }
        }
        return {
          regionId: region.id,
          name: region.name,
          openedBy: unique(openedBy),
          saveActions: extractAjaxActions(region.content).map(function (item) { return item.action; }).concat(region.metadata.formActions)
        };
      }),
    regions: regions.map(mapRegion),
    flows: buildFlows(regions, ajaxActions)
  };
}
