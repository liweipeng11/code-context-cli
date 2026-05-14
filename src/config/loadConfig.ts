import fs = require("fs");
import { CtxConfig, defaultConfig } from "./defaultConfig";
import { getConfigPath } from "../utils/pathUtils";

function mergeConfig(input: any): CtxConfig {
  /*
   * 配置文件是用户可编辑的，所以这里做防御式合并：
   * - 字段类型正确就使用用户值；
   * - 字段缺失或类型不对就回退默认值。
   */
  return {
    include: Array.isArray(input.include) ? input.include : defaultConfig.include,
    exclude: Array.isArray(input.exclude) ? input.exclude : defaultConfig.exclude,
    maxFileSizeKB: typeof input.maxFileSizeKB === "number" ? input.maxFileSizeKB : defaultConfig.maxFileSizeKB,
    chunk: {
      maxLines: input.chunk && typeof input.chunk.maxLines === "number" ? input.chunk.maxLines : defaultConfig.chunk.maxLines,
      overlapLines: input.chunk && typeof input.chunk.overlapLines === "number" ? input.chunk.overlapLines : defaultConfig.chunk.overlapLines
    },
    context: {
      maxTokens: input.context && typeof input.context.maxTokens === "number" ? input.context.maxTokens : defaultConfig.context.maxTokens,
      reserveOutputTokens: input.context && typeof input.context.reserveOutputTokens === "number" ? input.context.reserveOutputTokens : defaultConfig.context.reserveOutputTokens
    }
  };
}

export function loadConfig(rootDir: string): CtxConfig {
  var configPath = getConfigPath(rootDir);
  if (!fs.existsSync(configPath)) {
    // 没有执行 ctx init 时也允许 index/search 使用默认配置。
    return defaultConfig;
  }
  try {
    var parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return mergeConfig(parsed);
  } catch (err) {
    throw new Error("Failed to read .ctxrc.json: " + (err instanceof Error ? err.message : String(err)));
  }
}
