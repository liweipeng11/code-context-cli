# JSP to Vue Agent 逐步完善计划

## 1. 背景与目标

当前 `ctx-cli` 已经具备本地代码扫描、chunk 切分、索引、关键词检索、上下文 Markdown 生成能力。它现在最适合成为 JSP 转 Vue Agent 的“代码上下文工具层”。

JSP 转 Vue 的难点不是把一个 JSP 文件机械改写成 Vue，而是复现它背后的完整功能：

```text
JSP 页面
  -> include / 公共 JSP
  -> 表单 action / ajax URL / 页面跳转
  -> Struts 或 Spring 配置
  -> Java Action / Controller / Service
  -> request / session / model 数据
  -> 公共 JS / 字典 / taglib / 权限逻辑
  -> Vue 页面、API 方法、数据映射、交互逻辑
```

因此这个工具下一阶段的核心目标是：

> 让 Agent 可以根据 JSP 页面和提示词，主动调用工具发现依赖，只读取必要代码片段，并把这些片段组织成可用于多步骤转换的结构化上下文。

## 2. 总体路线

推荐分 8 个阶段推进：

```text
阶段 1：稳定现有索引与 chunk 能力
阶段 2：补充按需读取能力
阶段 3：实现 JSP 依赖分析
阶段 4：实现依赖追踪 trace
阶段 5：输出 Agent 可消费的结构化 JSON
阶段 6：增加转换任务状态管理
阶段 7：接入 LLM 多步骤转换流程
阶段 8：增强质量校验与自动修正
```

开发原则：

- 先做工具能力，再做 Agent 编排。
- 先支持规则明确的老系统模式，再考虑 embedding、AST、语义搜索。
- 每个能力都同时提供 CLI 命令和内部 TypeScript API。
- Agent 读取代码时优先读 chunk 或行号范围，不直接读取大文件全文。
- 所有中间结果尽量保存为 JSON，方便调试、恢复和复用。

## 3. 阶段 1：稳定现有索引与 chunk 能力

### 3.1 目标

保证 `ctx index .` 可以稳定扫描真实老系统项目，并生成高质量的 `.ctx/index.json`。

这个阶段是后续所有能力的基础。后面无论是 `deps`、`trace`、`agent`，都要依赖索引中的文件、chunk、行号、关键词和 links。

### 3.2 当前已有基础

当前项目已有这些模块：

```text
src/scanner/scanProject.ts
src/chunker/buildChunks.ts
src/chunker/chunkJspFile.ts
src/chunker/chunkJavaFile.ts
src/chunker/chunkXmlFile.ts
src/chunker/chunkVueFile.ts
src/chunker/chunkTextFile.ts
src/store/indexStore.ts
src/commands/index.ts
```

已有命令：

```bash
ctx init
ctx index .
ctx search "query"
ctx context "query"
```

### 3.3 建议数据结构

建议把 `CodeChunk` 稳定成下面这种结构：

```ts
export interface CodeChunk {
  id: string;
  filePath: string;
  fileHash: string;
  startLine: number;
  endLine: number;
  type: string;
  language: string;
  content: string;
  keywords: string[];
  links: string[];
  symbols?: string[];
  score?: number;
}
```

其中：

- `id`：稳定 chunk id，例如 `src/pages/UserDetail.jsp#20-88`。
- `filePath`：统一使用 `/`，避免 Windows 反斜杠影响检索。
- `fileHash`：用于判断索引是否过期。
- `type`：例如 `jsp-form`、`jsp-scriptlet`、`java-method`、`xml-struts-action`。
- `language`：例如 `jsp`、`java`、`xml`、`vue`、`js`。
- `keywords`：用于关键词检索。
- `links`：用于依赖追踪，例如 `.do`、`.jsp`、`.js`、`forward path`。
- `symbols`：可选，用于记录方法名、class 名、action path。

### 3.4 稳定 id 规则

推荐先使用路径加行号：

```text
<normalizedFilePath>#<startLine>-<endLine>
```

示例：

```text
src/pages/user/UserDetail.jsp#20-88
src/action/UserAction.java#120-180
WEB-INF/struts-config.xml#300-330
```

这个规则简单、可读、易调试。缺点是文件插入行后 id 会变化，但第一阶段可以接受。后续可以增加 `contentHash` 作为辅助。

### 3.5 chunk 切分策略

#### JSP

优先识别：

- page directive
- taglib directive
- include directive
- `<jsp:include>`
- `<form>`
- Struts `<html:form>`
- `<script>` 块
- scriptlet `<% ... %>`
- EL 表达式 `${...}`

建议 chunk 类型：

```text
jsp-directive
jsp-include
jsp-form
jsp-script
jsp-scriptlet
jsp-template
jsp-text
```

#### Java

优先按 class 和 method 切：

```text
java-class
java-method
java-block
```

对于老 Struts Action，额外提取：

- `execute`
- `mapping.findForward`
- `request.getParameter`
- `request.setAttribute`
- `session.setAttribute`
- Service 调用

#### XML

对 `struts-config.xml` 做特殊识别：

```text
xml-struts-action
xml-struts-forward
xml-bean
xml-mapping
xml-text
```

优先提取：

- `action path`
- `type`
- `name`
- `scope`
- `input`
- `forward name`
- `forward path`

### 3.6 实现步骤

1. 检查 `src/store/types.ts`，补齐 `CodeChunk` 字段。
2. 检查所有 `chunkXxxFile.ts`，确保返回字段一致。
3. 在 `buildChunks.ts` 中统一生成 `id`、`language`、`fileHash`。
4. 在 `indexStore.ts` 中保存索引版本号。
5. 给 `.ctx/index.json` 增加 `createdAt`、`rootDir`、`version`。

建议索引结构：

```ts
export interface CodeIndex {
  version: number;
  rootDir: string;
  createdAt: string;
  chunks: CodeChunk[];
}
```

### 3.7 边界情况

- 文件过大：跳过并记录 warning。
- 文件编码异常：跳过或按 utf8 尝试读取，记录 warning。
- 空文件：不生成 chunk。
- 行号计算：统一使用 `\r\n` 和 `\n` 兼容逻辑。
- 路径大小写：检索时统一转小写比较，但输出保留原路径。

### 3.8 验收标准

- 对真实老系统执行 `ctx index .` 不报错。
- `.ctx/index.json` 中每个 chunk 都有稳定 id、路径、行号、类型、内容。
- JSP、Java、XML 的 chunk 类型能反映业务结构。
- 重新索引后旧索引可以被覆盖。

## 4. 阶段 2：补充按需读取能力

### 4.1 目标

让 Agent 可以只读取必要代码片段，而不是读取整个大文件。

这是 AI IDE 类工具的核心能力之一。Agent 通常会先搜索，再根据搜索结果读某个 chunk；如果上下文不足，再读取某个方法上下几十行。

### 4.2 建议新增命令

```bash
ctx chunk get <chunkId>
ctx slice <filePath> --start <line> --end <line>
ctx around <filePath> --line <line> --before 30 --after 30
```

其中 `around` 可选，但非常实用。

### 4.3 建议新增模块

```text
src/tools/getChunk.ts
src/tools/readSlice.ts
src/tools/readAroundLine.ts
src/commands/chunk.ts
src/commands/slice.ts
src/commands/around.ts
```

### 4.4 内部 API 设计

```ts
export function getChunkById(rootDir: string, chunkId: string): CodeChunk;

export function readFileSlice(
  rootDir: string,
  filePath: string,
  startLine: number,
  endLine: number
): FileSlice;

export function readAroundLine(
  rootDir: string,
  filePath: string,
  line: number,
  before: number,
  after: number
): FileSlice;
```

建议类型：

```ts
export interface FileSlice {
  filePath: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  content: string;
}
```

### 4.5 CLI 输出设计

默认输出人类可读文本：

```text
File: src/action/UserAction.java
Lines: 120-180

```java
...
```
```

增加 `--json`：

```bash
ctx slice src/action/UserAction.java --start 120 --end 180 --json
```

JSON 输出：

```json
{
  "filePath": "src/action/UserAction.java",
  "startLine": 120,
  "endLine": 180,
  "totalLines": 420,
  "content": "..."
}
```

### 4.6 实现细节

- `chunk get` 从 `.ctx/index.json` 读取，不重新扫描文件。
- `slice` 直接读取源文件，适合获取 chunk 之外的上下文。
- 所有文件路径必须限制在项目根目录内，避免读取任意系统文件。
- `startLine < 1` 时裁剪为 `1`。
- `endLine > totalLines` 时裁剪为 `totalLines`。
- `startLine > endLine` 时返回错误。
- 默认限制最大读取行数，例如 300 行，避免一次读太多。

### 4.7 验收标准

- 可以通过 chunk id 精确读取索引中的 chunk。
- 可以读取指定文件的指定行号范围。
- 越界范围能被裁剪或返回清晰错误。
- 路径逃逸，例如 `../../secret.txt`，必须被拒绝。

## 5. 阶段 3：实现 JSP 依赖分析

### 5.1 目标

给定一个 JSP 文件，提取它直接声明或隐含的依赖线索。

这个阶段是 JSP 转 Vue 的关键。因为单个 JSP 页面通常只是视图层，真正的数据来源和行为分散在 action、include、JS、taglib、XML 配置里。

### 5.2 建议新增命令

```bash
ctx deps <jspFile>
ctx deps <jspFile> --json
```

### 5.3 建议新增模块

```text
src/deps/analyzeJspDependencies.ts
src/deps/types.ts
src/commands/deps.ts
```

### 5.4 输出结构

```ts
export interface JspDependencyReport {
  source: string;
  includes: JspIncludeRef[];
  forms: JspFormRef[];
  actions: ActionRef[];
  ajaxUrls: UrlRef[];
  scripts: FileRef[];
  styles: FileRef[];
  taglibs: TaglibRef[];
  requestAttributes: AttributeRef[];
  sessionAttributes: AttributeRef[];
  elExpressions: ExpressionRef[];
  customTags: CustomTagRef[];
  unresolved: RawRef[];
}
```

每个引用都建议保留行号和原始文本：

```ts
export interface LocatedRef {
  value: string;
  line: number;
  raw: string;
}
```

示例输出：

```json
{
  "source": "src/pages/UserDetail.jsp",
  "includes": [
    {
      "value": "../common/header.jsp",
      "line": 3,
      "raw": "<%@ include file=\"../common/header.jsp\" %>"
    }
  ],
  "forms": [
    {
      "action": "/user/save.do",
      "method": "post",
      "line": 42,
      "raw": "<form action=\"/user/save.do\" method=\"post\">"
    }
  ],
  "elExpressions": [
    {
      "value": "user.name",
      "line": 58,
      "raw": "${user.name}"
    }
  ]
}
```

### 5.5 第一版识别规则

优先使用正则和轻量扫描，不引入复杂 HTML/JSP AST。

#### include

识别：

```jsp
<%@ include file="..." %>
<jsp:include page="..." />
```

正则思路：

```text
/<%@\s*include\s+file=["']([^"']+)["']/
/<jsp:include\b[^>]*\bpage=["']([^"']+)["']/
```

#### form action

识别：

```jsp
<form action="...">
<html:form action="...">
```

需要记录：

- action
- method
- line
- raw
- 是否包含 `.do`

#### ajax URL

第一版识别常见写法：

```js
$.ajax({ url: "..." })
$.post("...")
$.get("...")
fetch("...")
axios.get("...")
axios.post("...")
```

#### script 和 style

识别：

```html
<script src="..."></script>
<link href="..." rel="stylesheet">
```

#### EL 表达式

识别：

```jsp
${user.name}
${deptList}
```

提取后需要拆出根变量：

```text
user.name -> user
deptList -> deptList
```

这些根变量后续用于查找 `request.setAttribute("user", ...)`。

#### request/session

识别 JSP scriptlet 中的：

```java
request.getAttribute("xxx")
request.setAttribute("xxx", ...)
session.getAttribute("xxx")
session.setAttribute("xxx", ...)
```

#### taglib

识别：

```jsp
<%@ taglib prefix="c" uri="..." %>
```

记录 prefix 和 uri。

#### custom tags

识别非标准标签前缀：

```jsp
<dict:select ...>
<app:button ...>
```

结合 taglib prefix 判断是否为自定义标签。

### 5.6 路径解析规则

JSP 中的路径需要转为候选项目路径：

- 相对路径：基于当前 JSP 文件目录解析。
- `/xxx.jsp`：从 WebRoot、webapp、src/main/webapp 等根目录尝试匹配。
- `.do`：不直接当文件路径，交给 trace 阶段解析 action mapping。
- 带 `${ctx}`、`<%=basePath%>` 的路径：保留原始值，提取可搜索片段。

### 5.7 验收标准

- 对真实 JSP 能输出 include、form action、ajax、script、EL、taglib。
- 每个依赖都有 line 和 raw，便于人工排查。
- 对动态路径不强行猜错，放入 `unresolved`。
- 输出 JSON 可直接作为 Agent 工具结果。

## 6. 阶段 4：实现依赖追踪 trace

### 6.1 目标

`deps` 只负责发现 JSP 里的直接线索。`trace` 要沿着这些线索继续找到相关代码片段。

例如：

```text
UserDetail.jsp
  -> /user/save.do
  -> struts-config.xml 中的 action path="/user/save"
  -> com.xxx.UserAction
  -> execute/save 方法
  -> request.setAttribute("user", user)
  -> forward userDetail.jsp
```

### 6.2 建议新增命令

```bash
ctx trace <jspFile>
ctx trace <jspFile> --json
ctx trace <jspFile> --depth 2
```

### 6.3 建议新增模块

```text
src/deps/traceDependencies.ts
src/deps/resolveInclude.ts
src/deps/resolveStrutsAction.ts
src/deps/resolveJavaClass.ts
src/deps/resolveForward.ts
src/commands/trace.ts
```

### 6.4 Trace 图结构

```ts
export interface TraceGraph {
  source: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
  unresolved: UnresolvedTrace[];
}

export interface TraceNode {
  id: string;
  kind: "jsp" | "include" | "action" | "xml" | "java" | "js" | "style" | "forward" | "attribute";
  value?: string;
  filePath?: string;
  chunkId?: string;
  startLine?: number;
  endLine?: number;
}

export interface TraceEdge {
  from: string;
  to: string;
  reason: string;
  line?: number;
}
```

### 6.5 Struts 解析策略

第一版重点支持 Struts 1。

给定 action `/user/save.do`：

1. 归一化为 `/user/save`。
2. 在索引中搜索 `struts-config.xml`。
3. 查找 `<action path="/user/save" ...>`。
4. 提取：
   - `type`
   - `name`
   - `scope`
   - `input`
   - `forward`
5. 根据 `type` 找 Java 文件。
6. 根据 forward path 找 JSP。

示例：

```xml
<action path="/user/save"
        type="com.demo.web.UserAction"
        name="userForm"
        scope="request">
  <forward name="success" path="/pages/user/detail.jsp"/>
</action>
```

### 6.6 Java 类解析策略

给定类名：

```text
com.demo.web.UserAction
```

转候选路径：

```text
com/demo/web/UserAction.java
```

然后：

- 优先路径后缀匹配。
- 匹配不到时用类名 `UserAction` 搜索。
- 找到后优先返回 `java-class` 或相关 `java-method` chunk。
- 对 Struts Action，优先寻找 `execute`、`save`、`list`、`init` 等方法。

### 6.7 Action 方法推断

老项目中 action 可能不直接对应方法，第一版可以按下面优先级：

1. URL 最后一段，例如 `/user/save.do` -> `save`。
2. JSP 表单隐藏字段，例如 `method=save`、`dispatch=save`。
3. Java 中是否出现 `save(` 方法。
4. Struts `DispatchAction` 模式。
5. 找不到则返回整个 Action class 的候选 chunk。

### 6.8 属性反查

对 JSP 中的 `${user}`、`${deptList}`，在 Java chunk 中搜索：

```java
request.setAttribute("user", ...)
request.setAttribute("deptList", ...)
session.setAttribute("user", ...)
```

这样可以把页面字段和后端数据来源连接起来。

### 6.9 验收标准

- 从 JSP 能追踪 include 文件。
- 从 form action / ajax URL 能找到 Struts action mapping。
- 从 action mapping 能找到 Java Action 文件。
- 从 Java Action 能找到 request/session attribute 来源。
- Trace 结果包含节点、边、行号和未解析项。

## 7. 阶段 5：结构化上下文生成

### 7.1 目标

把当前面向人类的 `.ctx/context.md` 扩展为 Agent 可消费的 JSON 上下文。

Agent 不只需要代码文本，还需要知道这些代码为什么被选中、和 JSP 有什么关系、token 花费多少、还有哪些未解析依赖。

### 7.2 建议命令

保留：

```bash
ctx context "query"
```

新增：

```bash
ctx context "query" --json
ctx context "query" --for-jsp src/pages/UserDetail.jsp --json
```

### 7.3 建议输出结构

```ts
export interface ContextJson {
  task: string;
  source?: string;
  selectedChunks: SelectedChunk[];
  dependencies?: JspDependencyReport;
  trace?: TraceGraph;
  tokenEstimate: TokenEstimate;
  unresolved: string[];
}
```

示例：

```json
{
  "task": "分析 UserDetail.jsp 转 Vue 的数据来源",
  "source": "src/pages/UserDetail.jsp",
  "selectedChunks": [
    {
      "id": "src/pages/UserDetail.jsp#20-88",
      "filePath": "src/pages/UserDetail.jsp",
      "startLine": 20,
      "endLine": 88,
      "type": "jsp-form",
      "reason": "source jsp form",
      "score": 21,
      "tokenEstimate": 820,
      "content": "..."
    }
  ],
  "tokenEstimate": {
    "maxTokens": 24000,
    "reserveOutputTokens": 4000,
    "usedTokens": 11800
  },
  "unresolved": []
}
```

### 7.4 选择 chunk 的优先级

当 token 预算有限时，建议按下面顺序保留：

1. 源 JSP 的结构性 chunk。
2. JSP include chunk。
3. form action / ajax 对应的 XML action chunk。
4. Java Action 相关 method chunk。
5. request/session attribute 来源 chunk。
6. 公共 JS 中被当前页面引用的函数。
7. 字典、权限、taglib 等辅助信息。
8. 低分关键词命中的泛相关 chunk。

### 7.5 实现步骤

1. 扩展 `runContext` 参数，支持 `json` 和 `forJsp`。
2. 如果传入 `forJsp`，先执行 `analyzeJspDependencies`。
3. 再执行 `traceDependencies`。
4. 将 trace 命中的 chunk 加入候选集。
5. 合并 keyword search 候选。
6. 去重。
7. 按 token 预算裁剪。
8. 输出 Markdown 或 JSON。

### 7.6 验收标准

- 原有 Markdown 行为不被破坏。
- `--json` 输出可以被 Agent 直接读取。
- `--for-jsp` 能把 deps 和 trace 纳入上下文选择。
- token 预算生效，不会无限塞代码。

## 8. 阶段 6：转换任务状态管理

### 8.1 目标

JSP 转 Vue 是多步骤任务，需要记录中间状态，支持中断恢复、人工复核和多轮修正。

### 8.2 建议目录结构

```text
.ctx/tasks/
  UserDetail/
    task.json
    deps.json
    trace.json
    context.json
    prompts/
    outputs/
    report.md
```

### 8.3 任务状态结构

```ts
export interface ConvertTask {
  id: string;
  source: string;
  target?: string;
  status: "created" | "analyzing" | "generating" | "verifying" | "done" | "failed";
  createdAt: string;
  updatedAt: string;
  steps: TaskStep[];
  dependencies: string[];
  selectedChunks: string[];
  decisions: TaskDecision[];
  generatedFiles: GeneratedFile[];
  warnings: string[];
}
```

### 8.4 建议命令

```bash
ctx task create <jspFile> --out <vueFile>
ctx task show <taskId>
ctx task list
ctx task reset <taskId>
ctx task add-note <taskId> "说明"
```

第一版可以先只做：

```bash
ctx task create <jspFile>
ctx task show <taskId>
```

### 8.5 任务 id 规则

推荐根据 JSP 文件名生成目录名：

```text
src/pages/user/UserDetail.jsp -> UserDetail
```

如果重名，追加短 hash：

```text
UserDetail-a13f09
```

### 8.6 实现细节

- 所有任务文件写入 `.ctx/tasks/<taskId>/`。
- `task.json` 是主状态。
- `deps.json`、`trace.json`、`context.json` 可重复生成。
- 每次更新 task 都更新 `updatedAt`。
- 文件写入时先写临时文件，再 rename，降低半写入风险。

### 8.7 验收标准

- 能创建任务目录和 `task.json`。
- 能展示任务当前状态。
- deps、trace、context 结果可以关联到任务。
- 中断后可以根据 `task.json` 继续。

## 9. 阶段 7：接入 LLM 多步骤转换流程

### 9.1 目标

把你已经拆好的多步骤提示词接入工具链，让 Agent 能够：

```text
分析 JSP
  -> 调用 deps / trace / chunk / slice
  -> 生成结构化理解
  -> 生成 Vue 初稿
  -> 检查遗漏
  -> 输出 Vue 文件和迁移报告
```

### 9.2 建议新增模块

```text
src/agent/runJspToVueAgent.ts
src/agent/promptSteps.ts
src/agent/llmClient.ts
src/agent/toolRunner.ts
src/commands/agent.ts
```

### 9.3 建议命令

```bash
ctx agent jsp-to-vue <jspFile> --out <vueFile>
ctx agent jsp-to-vue <jspFile> --dry-run
ctx agent jsp-to-vue <jspFile> --task <taskId>
```

第一版可以先不真正自动改文件：

```bash
ctx agent jsp-to-vue src/pages/UserDetail.jsp --dry-run
```

输出到：

```text
.ctx/tasks/UserDetail/outputs/UserDetail.vue
.ctx/tasks/UserDetail/report.md
```

### 9.4 多步骤提示词建议

建议拆成这些步骤：

```text
1. analyze-jsp-structure
2. collect-dependencies
3. analyze-data-source
4. analyze-events-and-actions
5. design-vue-state
6. design-api-layer
7. generate-vue-template
8. generate-vue-script
9. generate-final-vue
10. generate-migration-report
```

每一步都应该有明确输入和输出 JSON，避免只靠自然语言传递。

### 9.5 每步输入输出

#### analyze-jsp-structure

输入：

- 源 JSP chunk
- JSP deps

输出：

```json
{
  "pageTitle": "",
  "forms": [],
  "fields": [],
  "buttons": [],
  "tables": [],
  "dialogs": [],
  "events": []
}
```

#### analyze-data-source

输入：

- trace graph
- Java Action chunks
- XML action chunks

输出：

```json
{
  "initialData": [],
  "submitApis": [],
  "requestAttributes": [],
  "sessionAttributes": [],
  "fieldMappings": []
}
```

#### generate-final-vue

输入：

- 页面结构
- 数据来源
- 事件映射
- 项目 Vue 风格约束

输出：

```json
{
  "filePath": "src/views/UserDetail.vue",
  "content": "...",
  "warnings": []
}
```

### 9.6 LLM 接入方式

第一版建议保持简单：

- 读取环境变量中的 API key。
- 支持一个模型配置项。
- 每次调用保存 prompt 和 response 到任务目录，便于调试。

配置示例：

```json
{
  "llm": {
    "provider": "openai-compatible",
    "baseUrl": "https://api.example.com/v1",
    "model": "xxx"
  }
}
```

如果暂时不想接 API，可以先做 `--dry-run`，生成每一步 prompt 文件，人工复制给 LLM。

### 9.7 工具调用策略

第一版不必实现复杂 function calling。可以由程序固定编排：

```text
create task
run deps
run trace
build context
call prompt step 1
call prompt step 2
...
write outputs
```

后续再升级为模型自主选择工具：

```json
{
  "tool": "readFileSlice",
  "args": {
    "filePath": "src/action/UserAction.java",
    "startLine": 120,
    "endLine": 180
  }
}
```

### 9.8 验收标准

- 对简单 JSP 能生成 Vue 初稿。
- 每一步 prompt 和 response 都可追踪。
- 生成结果附带迁移报告。
- 对不确定的依赖能明确标记，而不是编造。

## 10. 阶段 8：质量校验与自动修正

### 10.1 目标

让 Agent 不只是生成代码，还能发现缺失、不一致和需要人工确认的问题。

### 10.2 建议命令

```bash
ctx verify <taskId>
ctx report <taskId>
```

### 10.3 校验项

#### JSP 字段覆盖

检查 JSP 中出现的：

- input name
- select name
- textarea name
- checkbox / radio
- hidden field
- 表格列

是否在 Vue 的 state、form model 或 template 中出现。

#### 事件覆盖

检查 JSP 中的：

- onclick
- onchange
- onsubmit
- href javascript
- ajax 调用

是否在 Vue methods 或 composable 中有对应实现。

#### API 覆盖

检查：

- form action
- ajax URL
- 页面初始化接口

是否生成了对应 API 方法。

#### 数据来源覆盖

检查：

- `${xxx}`
- request attribute
- session attribute

是否在迁移报告里说明来源。

#### 语法检查

如果目标项目支持：

```bash
npm run lint
npm run build
```

可以作为后续增强。第一版只做静态文本检查即可。

### 10.4 报告结构

```md
# JSP to Vue Migration Report

## Source

## Generated Files

## Field Mapping

## API Mapping

## Event Mapping

## Dependencies

## Unresolved Items

## Manual Review Checklist
```

### 10.5 验收标准

- 能列出字段映射表。
- 能列出 API 映射表。
- 能列出未处理 include、action、taglib、动态路径。
- 能生成适合人工复核的报告。

## 11. 推荐开发优先级

### P0：先做工具层

```text
1. 稳定 CodeChunk id 和索引结构
2. ctx chunk get <chunkId>
3. ctx slice <filePath> --start --end
4. ctx deps <jspFile> --json
5. ctx context "query" --json
```

### P1：做依赖追踪

```text
1. ctx trace <jspFile> --json
2. Struts action mapping 解析
3. Java Action 文件定位
4. request/session attribute 反查
```

### P2：做任务状态

```text
1. ctx task create
2. ctx task show
3. .ctx/tasks/<taskId>/task.json
4. 保存 deps / trace / context
```

### P3：接入 Agent

```text
1. 固定流程编排版 agent
2. dry-run prompt 输出
3. LLM 调用
4. Vue 初稿和 report 输出
```

### P4：增强质量

```text
1. verify
2. report
3. 自动补充缺失上下文
4. 自动修正循环
```

## 12. 最小可行版本

第一版 MVP 建议做到：

```bash
ctx agent jsp-to-vue src/pages/UserDetail.jsp --dry-run
```

它内部完成：

```text
1. 创建任务
2. 分析 JSP 依赖
3. 追踪 Struts / Java / include / JS
4. 生成 context.json
5. 生成多步骤 prompt 文件
6. 输出待人工复制给 LLM 的转换材料
```

MVP 输出：

```text
.ctx/tasks/UserDetail/task.json
.ctx/tasks/UserDetail/deps.json
.ctx/tasks/UserDetail/trace.json
.ctx/tasks/UserDetail/context.json
.ctx/tasks/UserDetail/prompts/01-analyze-jsp.md
.ctx/tasks/UserDetail/prompts/02-analyze-data-source.md
.ctx/tasks/UserDetail/prompts/03-generate-vue.md
```

这个版本不一定马上自动调用 LLM，但已经能显著减少你手动找依赖代码的工作量。

## 13. 当前最推荐的下一步

最推荐马上实现这三个能力：

```bash
ctx deps <jspFile> --json
ctx chunk get <chunkId>
ctx slice <filePath> --start <line> --end <line>
```

原因：

- `ctx deps` 解决 JSP 依赖发现问题。
- `ctx chunk get` 解决 Agent 精确读取索引片段的问题。
- `ctx slice` 解决大文件只读局部上下文的问题。

这三个能力完成后，你的 Agent 就可以从“只拿 JSP 单文件做转换”升级为：

```text
读 JSP
  -> 找依赖
  -> 找 action / include / js / attr
  -> 按需读取代码片段
  -> 交给多步骤提示词分析和生成 Vue
```

这就是后续 JSP 转 Vue Agent 的基础闭环。
