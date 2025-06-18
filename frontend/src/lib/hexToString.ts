export const hexToString = (hex: number): string => {
  return "#" + hex.toString(16).padStart(6, "0");
};
