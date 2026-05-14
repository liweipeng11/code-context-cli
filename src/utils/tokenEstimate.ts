export function estimateTokens(text: string): number {
  var chineseMatches = text.match(/[\u4e00-\u9fff]/g);
  var chineseCount = chineseMatches ? chineseMatches.length : 0;
  var withoutChinese = text.replace(/[\u4e00-\u9fff]/g, "");
  return chineseCount + Math.ceil(withoutChinese.length / 4);
}
