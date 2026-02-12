export const normalizeHex = (value: string): string | null => {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^#?([a-f0-9]{3}|[a-f0-9]{6})$/);
  if (!match) return null;

  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  return `#${hex}`;
};
