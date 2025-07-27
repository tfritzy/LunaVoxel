export const generateId = (prefix: string): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const uniquePart = Array.from(
    array,
    (byte) => chars[byte % chars.length]
  ).join("");
  return `${prefix}_${uniquePart}`;
};
