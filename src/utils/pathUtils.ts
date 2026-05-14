import path = require("path");

export function toDisplayPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function toRelativeDisplayPath(rootDir: string, filePath: string): string {
  return toDisplayPath(path.relative(rootDir, filePath));
}

export function resolveProjectPath(projectPath: string): string {
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
