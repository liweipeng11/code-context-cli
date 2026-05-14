/**
 * 一个 CodeChunk 表示“可以被搜索和放进上下文的一小段代码”。
 *
 * 为什么要切成 chunk：
 * 1. 大文件直接喂给 LLM 会浪费 token；
 * 2. 搜索时粒度太粗会把不相关代码一起带出来；
 * 3. JSP / Java / XML 这类老项目文件常常很长，chunk 能让相关性排序更有效。
 */
export interface CodeChunk {
  /** chunk 的唯一 id，第一版用 filePath + 序号即可，不依赖数据库自增 id。 */
  id: string;
  /** 统一使用 / 展示的相对路径，例如 src/pages/UserDetail.jsp。 */
  filePath: string;
  /** 根据扩展名推断出的语言，例如 jsp、java、xml、vue、ts。 */
  language: string;
  /** chunk 类型，例如 text、jsp-form、java-method、struts-action。 */
  type: string;
  /** 可选名称，例如 Java 方法名、class 名、Struts action path。 */
  name?: string;
  /** chunk 在原文件中的起始行号，从 1 开始。 */
  startLine: number;
  /** chunk 在原文件中的结束行号。 */
  endLine: number;
  /** chunk 的完整文本内容，最终会写入 context.md。 */
  content: string;
  /** 从代码中提取出的关键词，用于轻量搜索。 */
  keywords: string[];
  /** 从代码中提取出的路径、action、include、forward 等关联信息。 */
  links: string[];
  /** 搜索时计算出的临时分数，不一定会写入索引。 */
  score?: number;
}

/** 索引中记录的文件级信息，用来辅助判断文件是否变化和展示统计。 */
export interface IndexedFile {
  filePath: string;
  hash: string;
  size: number;
  chunks: number;
}

/** .ctx/index.json 的顶层结构。 */
export interface CodeIndex {
  version: string;
  createdAt: string;
  rootDir: string;
  files: IndexedFile[];
  chunks: CodeChunk[];
}
