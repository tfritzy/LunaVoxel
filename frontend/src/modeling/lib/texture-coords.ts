export const getTextureCoordinates = (
  textureIndex: number,
  atlasGridSize: number,
  pixelsPerTile: number
): number[] => {
  const textureSize = 1.0 / atlasGridSize;

  if (pixelsPerTile === 1) {
    const halfPixel = textureSize * 0.5;
    const u = (textureIndex % atlasGridSize) * textureSize + halfPixel;
    const v =
      Math.floor(textureIndex / atlasGridSize) * textureSize + halfPixel;
    const flippedV = 1.0 - v;
    return [u, flippedV, u, flippedV, u, flippedV, u, flippedV];
  } else {
    const inset = textureSize * 0.02;
    const u = (textureIndex % atlasGridSize) * textureSize;
    const v = Math.floor(textureIndex / atlasGridSize) * textureSize;
    const flippedVMin = 1.0 - (v + textureSize);
    const flippedVMax = 1.0 - v;

    return [
      u + inset,
      flippedVMax - inset,
      u + textureSize - inset,
      flippedVMax - inset,
      u + textureSize - inset,
      flippedVMin + inset,
      u + inset,
      flippedVMin + inset,
    ];
  }
};
