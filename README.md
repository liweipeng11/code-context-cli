# ctx-cli

`ctx-cli` is a small CommonJS TypeScript CLI that scans a local repository, builds a JSON code-chunk index, searches related snippets by keywords, and writes a `context.md` file for LLM prompts.

中文使用文档: [README.zh-CN.md](README.zh-CN.md)

The first version does not call any LLM, does not use embeddings, and does not require SQLite or native addons.

## Install

```bash
npm install
npm run build
```

Run locally:

```bash
node dist/cli.js init
node dist/cli.js index .
node dist/cli.js search "登录逻辑在哪里"
node dist/cli.js context "分析这个 JSP 转 Vue 需要哪些上下文"
```

After publishing or linking, the binary name is `ctx`:

```bash
npm link
ctx init
ctx index .
```

## Commands

```bash
ctx init
```

Creates `.ctxrc.json` in the current directory.

```bash
ctx index .
```

Scans the project, chunks source files, and writes `.ctx/index.json`.

```bash
ctx search "用户详情页的数据从哪里来"
```

Searches `.ctx/index.json` and prints ranked chunks.

```bash
ctx context "分析 UserDetail.jsp 转 Vue 需要哪些相关代码"
```

Searches relevant chunks, applies the token budget, and writes `.ctx/context.md`.

```bash
ctx clean
```

Deletes the `.ctx` directory.

## Windows 7 Notes

- Runtime target is Node.js 12.x/13.x or newer.
- The package is CommonJS only. Runtime output uses `require`.
- TypeScript target is `ES2018`.
- No optional chaining, nullish coalescing, top-level await, ESM runtime, native addon, database, or vector dependency is used.
- Paths are handled with Node's `path` module internally and displayed with `/`.
- The local index is plain JSON at `.ctx/index.json`.

## Config

`ctx init` writes:

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

## Development

```bash
npm install
npm run build
npm run dev -- search "login"
```

For Windows 7 compatibility, keep dependency versions conservative and avoid dependencies that require Node 14+ or native compilation.
