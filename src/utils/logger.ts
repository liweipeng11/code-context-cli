export function info(message: string): void {
  // 包一层 logger，后续如果要加 quiet/json 输出，不用到处改 console。
  console.log(message);
}

export function warn(message: string): void {
  console.warn("Warning: " + message);
}

export function error(message: string): void {
  console.error("Error: " + message);
}
