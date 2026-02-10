const textureCoordCache = new Map<number, Float64Array>();

export const getTextureCoordinates = (
  textureIndex: number,
  textureWidth: number
): Float64Array => {
  const key = textureIndex * 65536 + textureWidth;
  let cached = textureCoordCache.get(key);
  if (cached) return cached;
  const textureSize = 1.0 / textureWidth;
  const halfPixel = textureSize * 0.5;
  const u = (textureIndex % textureWidth) * textureSize + halfPixel;
  const v = Math.floor(textureIndex / textureWidth) * textureSize + halfPixel;
  const flippedV = 1.0 - v;
  cached = new Float64Array([u, flippedV, u, flippedV, u, flippedV, u, flippedV]);
  textureCoordCache.set(key, cached);
  return cached;
};
