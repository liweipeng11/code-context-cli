export interface JspRegion {
  id: string;
  type: string;
  name?: string;
  summary: string;
  startLine: number;
  endLine: number;
  content: string;
  keywords: string[];
  links: string[];
  symbols: string[];
  metadata: {
    regionId: string;
    regionType: string;
    regionName?: string;
    parentRegionId?: string;
    domIds: string[];
    formActions: string[];
    fields: string[];
    buttons: string[];
    tableColumns: string[];
    events: string[];
    jsFunctions: string[];
    jspVars: string[];
    jspScriptlets: string[];
    jstlVars: string[];
    includePaths: string[];
    externalJs: string[];
    externalCss: string[];
  };
}

interface RegionDraft {
  type: string;
  name?: string;
  startLine: number;
  endLine: number;
  priority: number;
}

interface TagMatch {
  openTag: string;
  startIndex: number;
  endIndex: number;
  startLine: number;
  endLine: number;
}

interface RegionMeta {
  domIds: string[];
  formActions: string[];
  fields: string[];
  buttons: string[];
  tableColumns: string[];
  events: string[];
  jsFunctions: string[];
  jspVars: string[];
  jspScriptlets: string[];
  jstlVars: string[];
  includePaths: string[];
  externalJs: string[];
  externalCss: string[];
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}

function sliceLines(lines: string[], startLine: number, endLine: number): string {
  return lines.slice(startLine - 1, endLine).join("\n");
}

function unique(values: string[]): string[] {
  var seen: { [key: string]: boolean } = {};
  var result: string[] = [];
  for (var i = 0; i < values.length; i++) {
    var value = cleanText(values[i]);
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

function cleanText(value: string | undefined): string {
  return (value || "")
    .replace(/<%--([\s\S]*?)--%>/g, "$1")
    .replace(/<!--([\s\S]*?)-->/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value: string): string {
  var ascii = value.toLowerCase().replace(/[^a-z0-9_$\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "");
  return ascii || "region";
}

function attr(openTag: string, name: string): string | undefined {
  var regex = new RegExp("\\b" + name + "\\s*=\\s*([\"'])(.*?)\\1", "i");
  var match = regex.exec(openTag);
  return match ? match[2] : undefined;
}

function attrs(openTag: string, names: string[]): string[] {
  var result: string[] = [];
  for (var i = 0; i < names.length; i++) {
    var value = attr(openTag, names[i]);
    if (value) {
      result.push(value);
    }
  }
  return result;
}

function stripTags(value: string): string {
  return cleanText(value.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " "));
}

function nearbyCommentName(lines: string[], startLine: number): string | undefined {
  var from = Math.max(1, startLine - 6);
  for (var i = startLine - 1; i >= from; i--) {
    var line = lines[i - 1] || "";
    var html = /<!--\s*([\s\S]*?)\s*-->/.exec(line);
    if (html && cleanText(html[1])) {
      return cleanText(html[1]);
    }
    var jsp = /<%--\s*([\s\S]*?)\s*--%>/.exec(line);
    if (jsp && cleanText(jsp[1])) {
      return cleanText(jsp[1]);
    }
  }
  return undefined;
}

function titleText(content: string): string | undefined {
  var patterns = [
    /<(?:h[1-6]|legend|caption)\b[^>]*>([\s\S]*?)<\/(?:h[1-6]|legend|caption)>/i,
    /<div\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:title|header|caption|legend|hd)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<span\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:title|header|caption|legend)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    /<td\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:title|header|caption|legend)[^"']*["'][^>]*>([\s\S]*?)<\/td>/i
  ];
  for (var i = 0; i < patterns.length; i++) {
    var match = patterns[i].exec(content);
    var text = match ? stripTags(match[1]) : "";
    if (isUsefulName(text)) {
      return text;
    }
  }
  return undefined;
}

function firstButtonText(content: string): string | undefined {
  return extractButtons(content)[0];
}

function isUsefulName(value: string | undefined): boolean {
  var text = cleanText(value);
  return !!text && text.length <= 80 && !/^[{}();,\[\].]+$/.test(text);
}

function inferName(openTag: string, content: string, lines: string[], startLine: number, fallback?: string): string | undefined {
  var comment = nearbyCommentName(lines, startLine);
  if (isUsefulName(comment)) {
    return comment;
  }
  var title = titleText(content);
  if (isUsefulName(title)) {
    return title;
  }
  var id = attr(openTag, "id");
  if (isUsefulName(id)) {
    return id;
  }
  var styleId = attr(openTag, "styleId");
  if (isUsefulName(styleId)) {
    return styleId;
  }
  var name = attr(openTag, "name");
  if (isUsefulName(name)) {
    return name;
  }
  var cls = attr(openTag, "class");
  if (isUsefulName(cls)) {
    return cls;
  }
  var button = firstButtonText(content);
  if (isUsefulName(button)) {
    return button;
  }
  return fallback;
}

function matchingClose(content: string, tagName: string, openIndex: number): number {
  var tagRegex = new RegExp("<\\/?\\s*" + tagName + "\\b[^>]*>", "gi");
  tagRegex.lastIndex = openIndex;
  var depth = 0;
  var match: RegExpExecArray | null;
  while ((match = tagRegex.exec(content)) !== null) {
    var tag = match[0];
    var isClose = /^<\//.test(tag);
    var selfClosing = /\/\s*>$/.test(tag);
    if (!isClose && !selfClosing) {
      depth++;
    } else if (isClose) {
      depth--;
      if (depth === 0) {
        return match.index + tag.length;
      }
    }
  }
  return -1;
}

function findTagBlocks(content: string, tagName: string): TagMatch[] {
  var result: TagMatch[] = [];
  var regex = new RegExp("<" + tagName + "\\b[^>]*>", "gi");
  var match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    var end = matchingClose(content, tagName, match.index);
    if (end < 0) {
      continue;
    }
    result.push({
      openTag: match[0],
      startIndex: match.index,
      endIndex: end,
      startLine: lineNumberAt(content, match.index),
      endLine: lineNumberAt(content, end)
    });
  }
  return result;
}

function addRegion(regions: RegionDraft[], draft: RegionDraft, totalLines: number): void {
  var start = Math.max(1, Math.floor(draft.startLine));
  var end = Math.min(totalLines, Math.floor(draft.endLine));
  if (start > end || end - start > Math.max(600, Math.floor(totalLines * 0.75))) {
    return;
  }
  regions.push({
    type: draft.type,
    name: draft.name,
    startLine: start,
    endLine: end,
    priority: draft.priority
  });
}

function markerText(openTag: string, content: string, name?: string): string {
  return (attrs(openTag, ["id", "name", "class", "style"]).join(" ") + " " + (name || "") + " " + stripTags(content.slice(0, 600))).toLowerCase();
}

function classifyForm(openTag: string, content: string, name?: string): string {
  var marker = markerText(openTag, content, name);
  var fields = extractFields(content);
  var hiddenFields = collect(content, /<input\b[^>]*\btype\s*=\s*["']hidden["'][^>]*\bname\s*=\s*["']([^"']+)["']/gi);
  if (/display\s*:\s*none|type\s*=\s*["']hidden["']|hidden|hide/i.test(marker) && hiddenFields.length > 0 && hiddenFields.length >= fields.length - 1) {
    return "jsp-hidden-form";
  }
  if (/(query|search|filter|find|condition|criteria|where|查询|检索|搜索|筛选|条件)/i.test(marker)) {
    return "jsp-form";
  }
  return "jsp-form";
}

function findFormRegions(content: string, lines: string[]): RegionDraft[] {
  var result: RegionDraft[] = [];
  var blocks = findTagBlocks(content, "(?:html:)?form");
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    var body = content.slice(block.startIndex, block.endIndex);
    var name = inferName(block.openTag, body, lines, block.startLine, "表单");
    result.push({
      type: classifyForm(block.openTag, body, name),
      name: name,
      startLine: block.startLine,
      endLine: block.endLine,
      priority: 90
    });
  }
  return result;
}

function findTableRegions(content: string, lines: string[]): RegionDraft[] {
  var result: RegionDraft[] = [];
  var blocks = findTagBlocks(content, "table");
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    var body = content.slice(block.startIndex, block.endIndex);
    var name = inferName(block.openTag, body, lines, block.startLine, "结果列表");
    var columns = extractTableColumns(body);
    var marker = markerText(block.openTag, body, name);
    if (columns.length === 0 && !/(grid|list|result|table|datagrid|列表|结果|明细|清单)/i.test(marker)) {
      continue;
    }
    result.push({
      type: /(grid|list|result|datagrid|列表|结果|清单)/i.test(marker) || columns.length > 0 ? "jsp-result-list" : "jsp-table",
      name: name,
      startLine: block.startLine,
      endLine: block.endLine,
      priority: 70
    });
  }
  return result;
}

function findContainerRegions(content: string, lines: string[]): RegionDraft[] {
  var result: RegionDraft[] = [];
  var tags = ["div", "td", "tr", "ul", "p"];
  for (var t = 0; t < tags.length; t++) {
    var blocks = findTagBlocks(content, tags[t]);
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      var body = content.slice(block.startIndex, block.endIndex);
      var name = inferName(block.openTag, body, lines, block.startLine);
      var marker = markerText(block.openTag, body, name);
      var buttons = extractButtons(body);
      var lineCount = block.endLine - block.startLine + 1;
      if (/(dialog|modal|popup|pop|layer|window|win|edit|detail|弹窗|窗口|模态|详情)/i.test(marker)) {
        result.push({ type: "jsp-dialog", name: name || "弹窗", startLine: block.startLine, endLine: block.endLine, priority: 85 });
      } else if (/(toolbar|tool-bar|tools|操作栏|工具栏)/i.test(marker) && buttons.length > 0) {
        result.push({ type: "jsp-toolbar", name: name || "工具栏", startLine: block.startLine, endLine: block.endLine, priority: 80 });
      } else if (/(pagination|pager|pagebar|page-nav|分页|翻页)/i.test(marker)) {
        result.push({ type: "jsp-pagination", name: name || "分页区域", startLine: block.startLine, endLine: block.endLine, priority: 80 });
      } else if (buttons.length >= 2 && lineCount <= 80 && /(btn|button|操作|提交|保存|删除|新增|修改|查询|重置|返回)/i.test(marker)) {
        result.push({ type: "jsp-button-group", name: name || "按钮组", startLine: block.startLine, endLine: block.endLine, priority: 60 });
      }
    }
  }
  return result;
}

function findDirectiveRegions(lines: string[]): RegionDraft[] {
  var result: RegionDraft[] = [];
  var start = 0;
  var end = 0;
  var includePaths: string[] = [];
  for (var i = 0; i < lines.length; i++) {
    if (/^\s*<%@\s*(page|taglib|include)\b/i.test(lines[i])) {
      if (start === 0) {
        start = i + 1;
      }
      end = i + 1;
      includePaths = includePaths.concat(collect(lines[i], /<%@\s*include[^%]+\bfile\s*=\s*["']([^"']+)["']/gi));
    } else if (start > 0) {
      result.push({ type: includePaths.length > 0 ? "jsp-include" : "jsp-directive", name: includePaths[0] || "directives", startLine: start, endLine: end, priority: 50 });
      start = 0;
      end = 0;
      includePaths = [];
    }
  }
  if (start > 0) {
    result.push({ type: includePaths.length > 0 ? "jsp-include" : "jsp-directive", name: includePaths[0] || "directives", startLine: start, endLine: end, priority: 50 });
  }
  return result;
}

function findIncludeRegions(content: string): RegionDraft[] {
  var result: RegionDraft[] = [];
  var regex = /<jsp:include\b[^>]*\bpage\s*=\s*["']([^"']+)["'][^>]*(?:\/>|>[\s\S]*?<\/jsp:include>)/gi;
  var match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    result.push({
      type: "jsp-include",
      name: match[1],
      startLine: lineNumberAt(content, match.index),
      endLine: lineNumberAt(content, match.index + match[0].length),
      priority: 65
    });
  }
  return result;
}

function findAssetRegions(lines: string[]): RegionDraft[] {
  var result: RegionDraft[] = [];
  var start = 0;
  var end = 0;
  for (var i = 0; i < lines.length; i++) {
    if (/<script\b[^>]+\bsrc\s*=/i.test(lines[i]) || /<link\b[^>]+\bhref\s*=/i.test(lines[i])) {
      if (start === 0) {
        start = i + 1;
      }
      end = i + 1;
    } else if (start > 0) {
      result.push({ type: "jsp-assets", name: "external assets", startLine: start, endLine: end, priority: 45 });
      start = 0;
      end = 0;
    }
  }
  if (start > 0) {
    result.push({ type: "jsp-assets", name: "external assets", startLine: start, endLine: end, priority: 45 });
  }
  return result;
}

function findScriptRegions(content: string): RegionDraft[] {
  var result: RegionDraft[] = [];
  var scriptRegex = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  var scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRegex.exec(content)) !== null) {
    var scriptBody = scriptMatch[1];
    var bodyOffset = scriptMatch.index + scriptMatch[0].indexOf(scriptBody);
    var functionRegex = /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{|(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*function\s*\([^)]*\)\s*\{|([A-Za-z_$][\w$]*)\s*:\s*function\s*\([^)]*\)\s*\{/g;
    var matches: Array<{ name: string; index: number }> = [];
    var functionMatch: RegExpExecArray | null;
    while ((functionMatch = functionRegex.exec(scriptBody)) !== null) {
      matches.push({ name: functionMatch[1] || functionMatch[2] || functionMatch[3], index: functionMatch.index });
    }
    if (matches.length === 0) {
      result.push({
        type: "jsp-script",
        name: "script",
        startLine: lineNumberAt(content, scriptMatch.index),
        endLine: lineNumberAt(content, scriptMatch.index + scriptMatch[0].length),
        priority: 40
      });
      continue;
    }
    for (var i = 0; i < matches.length; i++) {
      var start = bodyOffset + matches[i].index;
      var next = i + 1 < matches.length ? bodyOffset + matches[i + 1].index : scriptMatch.index + scriptMatch[0].length;
      result.push({
        type: "jsp-script-function",
        name: matches[i].name,
        startLine: lineNumberAt(content, start),
        endLine: lineNumberAt(content, next),
        priority: 55
      });
    }
  }
  return result;
}

function extractFields(content: string): string[] {
  return collect(content, /<(?:input|select|textarea)\b[^>]*\bname\s*=\s*["']([^"']+)["']/gi)
    .concat(collect(content, /<(?:html:)?(?:text|hidden|select|textarea|password|checkbox|radio)\b[^>]*\bproperty\s*=\s*["']([^"']+)["']/gi));
}

function extractButtons(content: string): string[] {
  return unique(collect(content, /<button\b[^>]*>([\s\S]*?)<\/button>/gi)
    .concat(collect(content, /<input\b[^>]*\btype\s*=\s*["'](?:button|submit|reset|image)["'][^>]*\bvalue\s*=\s*["']([^"']+)["']/gi))
    .concat(collect(content, /<input\b[^>]*\bvalue\s*=\s*["']([^"']+)["'][^>]*\btype\s*=\s*["'](?:button|submit|reset|image)["']/gi))
    .concat(collect(content, /<a\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:btn|button|linkbutton)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi))
    .concat(collect(content, /<a\b[^>]*\bonclick\s*=\s*["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map(stripTags));
}

function extractTableColumns(content: string): string[] {
  return unique(collect(content, /<th\b[^>]*>([\s\S]*?)<\/th>/gi)
    .concat(collect(content, /<td\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:head|title|column|th)[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi))
    .map(stripTags)
    .filter(function (value) { return value.length > 0 && value.length <= 40; }));
}

function extractEvents(content: string): string[] {
  return collect(content, /\bon[A-Za-z]+\s*=\s*["'][^"']*?([A-Za-z_$][\w$]*)\s*\(/g)
    .concat(collect(content, /\$\([^)]*\)\.(?:on|click|change|submit|keyup|keydown|blur|focus)\s*\([^)]*?([A-Za-z_$][\w$]*)\s*\)/g))
    .concat(collect(content, /\.(?:click|change|submit|keyup|keydown|blur|focus)\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g));
}

function extractMeta(content: string): RegionMeta {
  var formActions = collect(content, /<(?:html:)?form[^>]+\baction\s*=\s*["']([^"']+)["']/gi);
  var includePaths = collect(content, /<jsp:include[^>]+\bpage\s*=\s*["']([^"']+)["']/gi)
    .concat(collect(content, /<%@\s*include[^%]+\bfile\s*=\s*["']([^"']+)["']/gi));
  var jsFunctions = collect(content, /function\s+([A-Za-z_$][\w$]*)\s*\(/g)
    .concat(collect(content, /(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*function\s*\(/g))
    .concat(collect(content, /([A-Za-z_$][\w$]*)\s*:\s*function\s*\(/g));
  return {
    domIds: collect(content, /\bid\s*=\s*["']([^"']+)["']/gi)
      .concat(collect(content, /\bstyleId\s*=\s*["']([^"']+)["']/gi)),
    formActions: formActions,
    fields: extractFields(content),
    buttons: extractButtons(content),
    tableColumns: extractTableColumns(content),
    events: extractEvents(content),
    jsFunctions: jsFunctions,
    jspVars: collect(content, /\$\{\s*([^}\s]+)[^}]*\}/g),
    jspScriptlets: collect(content, /<%=\s*([\s\S]*?)\s*%>/g),
    jstlVars: collect(content, /<c:set\b[^>]*\bvar\s*=\s*["']([^"']+)["']/gi)
      .concat(collect(content, /<c:forEach\b[^>]*\bvar\s*=\s*["']([^"']+)["']/gi))
      .concat(collect(content, /<c:catch\b[^>]*\bvar\s*=\s*["']([^"']+)["']/gi)),
    includePaths: includePaths,
    externalJs: collect(content, /<script[^>]+\bsrc\s*=\s*["']([^"']+)["']/gi),
    externalCss: collect(content, /<link[^>]+\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)
  };
}

function summaryFor(type: string, meta: RegionMeta): string {
  if (type === "jsp-form" || type === "jsp-hidden-form") {
    return (type === "jsp-hidden-form" ? "隐藏表单" : "查询表单") + "，包含 " + meta.fields.length + " 个字段和 " + meta.buttons.length + " 个按钮。";
  }
  if (type === "jsp-result-list" || type === "jsp-table") {
    return "结果列表，包含 " + meta.tableColumns.length + " 个列和 " + meta.buttons.length + " 个按钮。";
  }
  if (type === "jsp-toolbar" || type === "jsp-button-group") {
    return (type === "jsp-toolbar" ? "工具栏" : "按钮组") + "，包含 " + meta.buttons.length + " 个按钮。";
  }
  if (type === "jsp-dialog") {
    return "弹窗 / 模态框，包含 " + meta.fields.length + " 个字段和 " + meta.buttons.length + " 个按钮。";
  }
  if (type === "jsp-pagination") {
    return "分页区域。";
  }
  if (type === "jsp-script-function") {
    return "script 函数，关联 " + meta.events.length + " 个事件引用。";
  }
  if (type === "jsp-include") {
    return "JSP include 区块，引用 " + meta.includePaths.length + " 个路径。";
  }
  if (type === "jsp-assets") {
    return "外部资源区块，包含 " + meta.externalJs.length + " 个 JS 和 " + meta.externalCss.length + " 个 CSS。";
  }
  if (type === "jsp-directive") {
    return "JSP directive 区块。";
  }
  return "JSP 区域。";
}

function buildRegionId(type: string, name: string | undefined, startLine: number, used: { [key: string]: number }): string {
  var base = slug((name || type).replace(/^jsp-/, ""));
  var id = base + "-" + startLine;
  if (used[id]) {
    used[id]++;
    return id + "-" + used[id];
  }
  used[id] = 1;
  return id;
}

function sameSpan(a: RegionDraft, b: RegionDraft): boolean {
  return a.startLine === b.startLine && a.endLine === b.endLine && a.type === b.type && (a.name || "") === (b.name || "");
}

function containsSpan(parent: RegionDraft, child: RegionDraft): boolean {
  return parent.startLine <= child.startLine && parent.endLine >= child.endLine;
}

function smallRegion(region: RegionDraft): boolean {
  return region.endLine - region.startLine <= 8;
}

function pruneRegions(drafts: RegionDraft[]): RegionDraft[] {
  drafts.sort(function (a, b) {
    if (a.startLine !== b.startLine) {
      return a.startLine - b.startLine;
    }
    if (a.endLine !== b.endLine) {
      return b.endLine - a.endLine;
    }
    return b.priority - a.priority;
  });

  var deduped: RegionDraft[] = [];
  for (var i = 0; i < drafts.length; i++) {
    var duplicate = false;
    for (var d = 0; d < deduped.length; d++) {
      if (sameSpan(drafts[i], deduped[d])) {
        duplicate = true;
        if (drafts[i].priority > deduped[d].priority) {
          deduped[d] = drafts[i];
        }
        break;
      }
    }
    if (!duplicate) {
      deduped.push(drafts[i]);
    }
  }

  var result: RegionDraft[] = [];
  for (var n = 0; n < deduped.length; n++) {
    var current = deduped[n];
    var noisyChild = false;
    for (var p = 0; p < deduped.length; p++) {
      if (n === p) {
        continue;
      }
      var parent = deduped[p];
      if (!containsSpan(parent, current)) {
        continue;
      }
      if (parent.startLine === current.startLine && parent.endLine === current.endLine) {
        continue;
      }
      if (parent.type === current.type && parent.priority >= current.priority) {
        noisyChild = true;
      }
      if ((parent.type === "jsp-dialog" || parent.type === "jsp-form") && smallRegion(current) && current.type === "jsp-button-group") {
        noisyChild = true;
      }
    }
    if (!noisyChild) {
      result.push(current);
    }
  }

  result.sort(function (a, b) {
    if (a.startLine !== b.startLine) {
      return a.startLine - b.startLine;
    }
    return a.endLine - b.endLine;
  });
  return result;
}

function assignParents(regions: JspRegion[]): void {
  var best: JspRegion | undefined;
  for (var i = 0; i < regions.length; i++) {
    var child = regions[i];
    best = undefined;
    for (var p = 0; p < regions.length; p++) {
      if (i === p) {
        continue;
      }
      var parent = regions[p];
      if (parent.startLine <= child.startLine && parent.endLine >= child.endLine && (parent.startLine !== child.startLine || parent.endLine !== child.endLine)) {
        if (!best || (parent.endLine - parent.startLine) < (best.endLine - best.startLine)) {
          best = parent;
        }
      }
    }
    if (best) {
      child.metadata.parentRegionId = best.id;
    }
  }
}

function enrichRegion(draft: RegionDraft, lines: string[], used: { [key: string]: number }): JspRegion {
  var content = sliceLines(lines, draft.startLine, draft.endLine);
  var meta = extractMeta(content);
  var name = draft.name || meta.domIds[0] || meta.fields[0] || meta.buttons[0] || meta.jsFunctions[0];
  var id = buildRegionId(draft.type, name, draft.startLine, used);
  var keywords = meta.domIds.concat(meta.formActions).concat(meta.fields).concat(meta.buttons).concat(meta.tableColumns)
    .concat(meta.events).concat(meta.jsFunctions).concat(meta.jspVars).concat(meta.jspScriptlets).concat(meta.jstlVars)
    .concat(meta.includePaths).concat(meta.externalJs).concat(meta.externalCss);
  var links = meta.includePaths.concat(meta.externalJs).concat(meta.externalCss).concat(meta.formActions);
  var symbols = meta.domIds.concat(meta.fields).concat(meta.events).concat(meta.jsFunctions).concat(meta.jspVars).concat(meta.jstlVars);
  return {
    id: id,
    type: draft.type,
    name: name,
    summary: summaryFor(draft.type, meta),
    startLine: draft.startLine,
    endLine: draft.endLine,
    content: content,
    keywords: unique(keywords),
    links: unique(links),
    symbols: unique(symbols),
    metadata: {
      regionId: id,
      regionType: draft.type,
      regionName: name,
      domIds: meta.domIds,
      formActions: meta.formActions,
      fields: meta.fields,
      buttons: meta.buttons,
      tableColumns: meta.tableColumns,
      events: meta.events,
      jsFunctions: meta.jsFunctions,
      jspVars: meta.jspVars,
      jspScriptlets: meta.jspScriptlets,
      jstlVars: meta.jstlVars,
      includePaths: meta.includePaths,
      externalJs: meta.externalJs,
      externalCss: meta.externalCss
    }
  };
}

export function parseJspRegions(content: string): JspRegion[] {
  var lines = content.split(/\r?\n/);
  var drafts: RegionDraft[] = [];
  var totalLines = lines.length;
  var all = findDirectiveRegions(lines)
    .concat(findIncludeRegions(content))
    .concat(findAssetRegions(lines))
    .concat(findFormRegions(content, lines))
    .concat(findTableRegions(content, lines))
    .concat(findContainerRegions(content, lines))
    .concat(findScriptRegions(content));

  for (var i = 0; i < all.length; i++) {
    addRegion(drafts, all[i], totalLines);
  }
  if (drafts.length === 0) {
    addRegion(drafts, { type: "jsp-text", startLine: 1, endLine: totalLines, priority: 1 }, totalLines);
  }

  drafts = pruneRegions(drafts);
  var used: { [key: string]: number } = {};
  var regions: JspRegion[] = [];
  for (var n = 0; n < drafts.length; n++) {
    regions.push(enrichRegion(drafts[n], lines, used));
  }
  assignParents(regions);
  return regions;
}
