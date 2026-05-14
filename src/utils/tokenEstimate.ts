export function estimateTokens(text: string): number {
  /*
   * 非精确 token 估算：
   * - 中文按 1 字约 1 token；
   * - 其他文本按 4 字符约 1 token。
   *
   * 这样不依赖 tokenizer，兼容 Windows 7 / Node 12，也足够做预算裁剪。
   */
  var chineseMatches = text.match(/[\u4e00-\u9fff]/g);
  var chineseCount = chineseMatches ? chineseMatches.length : 0;
  var withoutChinese = text.replace(/[\u4e00-\u9fff]/g, "");
  return chineseCount + Math.ceil(withoutChinese.length / 4);
}
