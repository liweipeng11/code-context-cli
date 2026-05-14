import crypto = require("crypto");

export function fileHash(content: string): string {
  return crypto.createHash("sha1").update(content, "utf8").digest("hex");
}
