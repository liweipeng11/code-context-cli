export function info(message: string): void {
  console.log(message);
}

export function warn(message: string): void {
  console.warn("Warning: " + message);
}

export function error(message: string): void {
  console.error("Error: " + message);
}
