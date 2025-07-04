export const getTextureCoordinates = (
  textureIndex: number,
  atlasSize: number,
  pixelsPerTile: number
): number[] => {
  const textureSize = 1.0 / atlasSize;

  if (pixelsPerTile === 1) {
    const halfPixel = textureSize * 0.5;
    const u = (textureIndex % atlasSize) * textureSize + halfPixel;
    const v = Math.floor(textureIndex / atlasSize) * textureSize + halfPixel;
    const flippedV = 1.0 - v;
    return [u, flippedV, u, flippedV, u, flippedV, u, flippedV];
  } else {
    const totalAtlasPixels = atlasSize * pixelsPerTile;
    const inset = 0.5 / totalAtlasPixels;
    const u = (textureIndex % atlasSize) * textureSize;
    const v = Math.floor(textureIndex / atlasSize) * textureSize;
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
