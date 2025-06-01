export function generateId(prefix: string): string {
  const uniquePart = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${uniquePart}`;
}
