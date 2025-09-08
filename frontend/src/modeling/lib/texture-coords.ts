export const getTextureCoordinates = (
  textureIndex: number,
  textureWidth: number
): number[] => {
  const textureSize = 1.0 / textureWidth;
  const halfPixel = textureSize * 0.5;
  const u = (textureIndex % textureWidth) * textureSize + halfPixel;
  const v = Math.floor(textureIndex / textureWidth) * textureSize + halfPixel;
  const flippedV = 1.0 - v;
  return [u, flippedV, u, flippedV, u, flippedV, u, flippedV];
};
