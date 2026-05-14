# ctx-cli 中文使用文档

`ctx-cli` 是一个轻量级命令行工具，用来扫描本地代码仓库、切分代码文件、建立本地 JSON 索引，并根据用户问题检索相关代码片段，最终生成适合复制给 LLM 的 `context.md`。

第一版只做本地代码上下文整理，不调用 LLM，不使用 embedding，不依赖数据库，也不需要 SQLite、Qdrant 或任何 native addon。

## 适用场景

- 分析老项目代码结构
- 查找某个页面、接口或功能相关的代码
- 辅助 JSP 转 Vue、Java 后端迁移、Struts 配置梳理
- 给 ChatGPT、Claude 或其他 LLM 准备代码上下文
- 在无法接入在线服务的环境里做本地代码检索

## 环境要求

- Node.js `>=12`
- npm
- Windows、Linux、macOS 均可运行

为了兼容 Windows 7，本项目刻意保持了较保守的技术选择：

- 使用 CommonJS，不使用 ESM runtime
- TypeScript 编译目标为 `ES2018`
- 不使用 optional chaining、nullish coalescing、top-level await
- 不使用 native addon
- 不使用数据库
- 索引文件使用普通 JSON
- 内部路径处理使用 Node.js `path` 模块
- 命令行输出不依赖现代终端能力

## 安装与构建

在项目目录中执行：

```bash
npm install
npm run build
```

构建完成后，会生成 `dist` 目录。

可以直接通过 Node.js 运行：

```bash
node dist/cli.js init
node dist/cli.js index .
node dist/cli.js search "登录逻辑在哪里"
node dist/cli.js context "分析这个 JSP 转 Vue 需要哪些上下文"
```

也可以在本地开发时使用：

```bash
npm run dev -- search "登录逻辑在哪里"
```

## 全局命令方式

如果希望使用 `ctx` 命令，可以在项目目录执行：

```bash
npm link
```

之后可以运行：

```bash
ctx init
ctx index .
ctx search "用户详情页的数据从哪里来"
ctx context "分析 UserDetail.jsp 转 Vue 需要哪些相关代码"
```

## 基本使用流程

推荐按下面顺序使用：

```bash
ctx init
ctx index .
ctx search "登录逻辑在哪里"
ctx context "分析登录功能改造需要哪些代码上下文"
```

执行后会产生：

```text
.ctxrc.json
.ctx/index.json
.ctx/context.md
```

其中：

- `.ctxrc.json` 是配置文件
- `.ctx/index.json` 是代码 chunk 索引
- `.ctx/context.md` 是最终给 LLM 使用的上下文文件

## 命令说明

### 初始化配置

```bash
ctx init
```

在当前目录生成 `.ctxrc.json`。

如果配置文件已经存在，命令不会覆盖它。

### 建立索引

```bash
ctx index .
```

扫描当前目录下的代码文件，并生成：

```text
.ctx/index.json
```

索引内容包括：

- 文件路径
- 文件 hash
- chunk id
- chunk 类型
- 起始行号
- 结束行号
- chunk 内容
- 关键词
- 关联链接

也可以指定其他目录：

```bash
ctx index D:\workspace\my-project
```

### 搜索代码

```bash
ctx search "用户详情页的数据从哪里来"
```

命令会读取 `.ctx/index.json`，搜索相关 chunk，并在终端输出类似结果：

```text
[1] src/pages/UserDetail.jsp:20-88 score=15
chunk 摘要内容...

[2] WEB-INF/struts-config.xml:130-150 score=11
chunk 摘要内容...
```

可以通过 `-n` 指定输出数量：

```bash
ctx search "登录逻辑在哪里" -n 20
```

### 生成上下文

```bash
ctx context "分析 UserDetail.jsp 转 Vue 需要哪些相关代码"
```

命令会先搜索相关代码片段，再根据 token 预算选择最相关的 chunk，最后生成：

```text
.ctx/context.md
```

生成的 Markdown 结构大致如下：

```markdown
# Code Context

## User Task

分析 UserDetail.jsp 转 Vue 需要哪些相关代码

## Selected Files

- src/pages/UserDetail.jsp:20-88
- WEB-INF/struts-config.xml:130-150
- src/action/UserAction.java:30-140

## Context Chunks

### File: src/pages/UserDetail.jsp

Lines: 20-88
Type: jsp-form

```jsp
...
```
```

可以指定候选 chunk 数量：

```bash
ctx context "分析登录功能" -n 50
```

### 清理索引

```bash
ctx clean
```

删除 `.ctx` 目录，包括索引和生成的上下文文件。

## 配置文件

`ctx init` 默认生成的 `.ctxrc.json` 内容如下：

```json
{
  "include": [
    "**/*.js",
    "**/*.ts",
    "**/*.vue",
    "**/*.jsx",
    "**/*.tsx",
    "**/*.jsp",
    "**/*.java",
    "**/*.xml",
    "**/*.html",
    "**/*.css",
    "**/*.md"
  ],
  "exclude": [
    "node_modules/**",
    "dist/**",
    "build/**",
    ".git/**",
    "target/**",
    ".ctx/**"
  ],
  "maxFileSizeKB": 512,
  "chunk": {
    "maxLines": 120,
    "overlapLines": 20
  },
  "context": {
    "maxTokens": 24000,
    "reserveOutputTokens": 4000
  }
}
```

### include

指定需要扫描的文件类型。

默认包含：

- JavaScript / TypeScript
- Vue
- JSP
- Java
- XML
- HTML
- CSS
- Markdown

### exclude

指定需要忽略的目录或文件。

默认忽略：

- `node_modules`
- `dist`
- `build`
- `.git`
- `target`
- `.ctx`

### maxFileSizeKB

单个文件最大扫描大小，默认 `512KB`。

超过限制的文件会被跳过，避免把大型压缩文件、构建产物或异常大文件写入索引。

### chunk.maxLines

普通文件每个 chunk 的最大行数，默认 `120`。

### chunk.overlapLines

相邻 chunk 之间保留的重叠行数，默认 `20`。

这样可以减少函数或配置被切断后丢失上下文的问题。

### context.maxTokens

生成 `context.md` 时的最大 token 预算，默认 `24000`。

### context.reserveOutputTokens

预留给 LLM 输出的 token 数，默认 `4000`。

实际用于代码上下文的预算约为：

```text
context.maxTokens - context.reserveOutputTokens
```

## Chunk 规则

### 普通文本文件

按固定行数切分：

- 默认每 120 行一个 chunk
- 相邻 chunk 重叠 20 行

### JSP 文件

会优先识别：

- `jsp:include`
- `iframe`
- `form`
- `showModalDialog`
- scriptlet
- EL 表达式

第一版使用正则提取关键词和链接，不做完整 AST 解析。

### Java 文件

会粗略按 class / method 切分，并识别：

- `class xxx`
- `public/private/protected` 方法
- `request.getParameter`
- `request.setAttribute`
- `mapping.findForward`
- `forward`

### XML 文件

对 `struts-config.xml` 做了特殊支持，会识别：

- `action path`
- `type`
- `name`
- `scope`
- `input`
- `forward name`
- `forward path`

### Vue 文件

会识别：

- `template`
- `script`
- `style`

每个区域可以作为独立 chunk。`script` 内部还会粗略识别 `function` 或 `const xxx =`。

## 检索评分

第一版使用关键词检索，不做向量搜索。

搜索时会检查：

- `filePath`
- `content`
- `keywords`
- `links`

基础评分规则：

- 文件路径命中：`+8`
- keywords 命中：`+5`
- links 命中：`+5`
- content 命中：`+2`
- query 中出现文件名并命中：`+15`
- JSP / XML / Java 之间存在路径关联：`+10`

## Token 估算

第一版使用粗略估算：

- 中文：约 1 个汉字等于 1 token
- 英文：约 4 个字符等于 1 token

这个估算不追求精确，只用于本地上下文预算裁剪。

## Windows 7 使用注意事项

建议使用 Node.js 12.x 或 13.x。

不要把依赖升级到需要 Node.js 14、16 或 18 的版本，尤其是：

- 新版 CLI 框架
- 需要 ESM 的库
- 需要 native 编译的库
- 数据库驱动
- tokenizer 或 embedding 相关库

如果在 Windows 7 上运行，推荐流程是：

```bash
npm install
npm run build
node dist/cli.js init
node dist/cli.js index .
node dist/cli.js search "登录逻辑在哪里"
node dist/cli.js context "分析这个 JSP 转 Vue 需要哪些上下文"
```

路径中可以包含 Windows 反斜杠，但输出会统一显示为 `/`，方便复制给 LLM。

## 常见问题

### 为什么搜索结果不够准？

第一版只使用关键词检索，没有 embedding，也没有 AST 精准分析。

可以尝试：

- 在 query 中写出文件名
- 写出接口名、页面名、action 名
- 写出 `.jsp`、`.do`、`.java` 等明确引用
- 先用 `ctx search` 找到候选，再用更具体的问题运行 `ctx context`

### 修改代码后需要重新索引吗？

需要。

代码发生变化后，请重新执行：

```bash
ctx index .
```

### `.ctx/index.json` 可以提交到 Git 吗？

通常不建议提交。

它是本地生成文件，建议加入 `.gitignore`：

```gitignore
.ctx/
```

### 会上传代码吗？

不会。

第一版完全在本地运行，不调用 OpenAI API，不请求远程 LLM，也不连接向量数据库。

### 能不能直接修改代码？

不能。

第一版只负责扫描、检索和生成上下文，不做自动改代码、不做 Agent、不做文件监听。

## 推荐工作流

1. 在目标项目根目录运行 `ctx init`
2. 根据项目情况调整 `.ctxrc.json`
3. 运行 `ctx index .`
4. 用 `ctx search` 试探相关代码
5. 用更具体的问题运行 `ctx context`
6. 打开 `.ctx/context.md`
7. 将内容复制给 LLM，配合你的任务说明进行分析或改造

## 当前版本边界

当前版本不包含：

- embedding
- Qdrant
- SQLite
- OpenAI API 调用
- Agent
- 自动修改代码
- AST 精准解析
- 文件监听
- Web UI
- VSCode 插件

这些能力适合在后续版本中逐步加入。
