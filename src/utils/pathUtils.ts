import path = require("path");

export function toDisplayPath(filePath: string): string {
  // 对外展示统一使用 /，这样复制到 Markdown 或 LLM 里更稳定。
  return filePath.split(path.sep).join("/");
}

export function toRelativeDisplayPath(rootDir: string, filePath: string): string {
  // 内部仍然用 path.relative 处理 Windows/Linux 差异，最后才转展示路径。
  return toDisplayPath(path.relative(rootDir, filePath));
}

export function resolveProjectPath(projectPath: string): string {
  // 命令行传入相对路径时，以当前工作目录为基准解析。
  return path.resolve(process.cwd(), projectPath);
}

export function getCtxDir(rootDir: string): string {
  return path.join(rootDir, ".ctx");
}

export function getIndexPath(rootDir: string): string {
  return path.join(getCtxDir(rootDir), "index.json");
}

export function getContextPath(rootDir: string): string {
  return path.join(getCtxDir(rootDir), "context.md");
}

export function getConfigPath(rootDir: string): string {
  return path.join(rootDir, ".ctxrc.json");
}
