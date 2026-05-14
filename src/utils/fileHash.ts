import crypto = require("crypto");

export function fileHash(content: string): string {
  // 用 sha1 标识文件内容变化。这里不是安全用途，只是索引用的内容指纹。
  return crypto.createHash("sha1").update(content, "utf8").digest("hex");
}
