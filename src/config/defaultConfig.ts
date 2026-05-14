export interface CtxConfig {
  /** 要扫描的文件 glob。 */
  include: string[];
  /** 要忽略的文件或目录 glob。 */
  exclude: string[];
  /** 单个文件最大大小，超过后跳过，避免索引异常大文件。 */
  maxFileSizeKB: number;
  chunk: {
    /** 普通文本切分时每个 chunk 的最大行数。 */
    maxLines: number;
    /** 相邻 chunk 的重叠行数，用来保留跨边界上下文。 */
    overlapLines: number;
  };
  context: {
    /** LLM 总 token 预算的粗略上限。 */
    maxTokens: number;
    /** 给 LLM 输出预留的 token，不放入上下文。 */
    reserveOutputTokens: number;
  };
}

/** 默认配置需要足够保守，保证第一次运行就能避开常见大目录。 */
export const defaultConfig: CtxConfig = {
  include: [
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
  exclude: [
    "node_modules/**",
    "dist/**",
    "build/**",
    ".git/**",
    "target/**",
    ".ctx/**"
  ],
  maxFileSizeKB: 512,
  chunk: {
    maxLines: 120,
    overlapLines: 20
  },
  context: {
    maxTokens: 24000,
    reserveOutputTokens: 4000
  }
};
