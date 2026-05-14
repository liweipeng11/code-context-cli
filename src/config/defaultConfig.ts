export interface CtxConfig {
  include: string[];
  exclude: string[];
  maxFileSizeKB: number;
  chunk: {
    maxLines: number;
    overlapLines: number;
  };
  context: {
    maxTokens: number;
    reserveOutputTokens: number;
  };
}

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
