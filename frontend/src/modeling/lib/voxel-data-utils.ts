export const PREVIEW_BIT_MASK = 0x08;
export const BLOCK_TYPE_SHIFT = 6;
export const BLOCK_TYPE_MASK = 0x3ff;
export const ROTATION_MASK = 0x07;
export const CLEAR_PREVIEW_BIT_MASK = 0xfffffff7;

export const getBlockType = (blockValue: number): number => {
  return (blockValue >> BLOCK_TYPE_SHIFT) & BLOCK_TYPE_MASK;
};

export const isBlockPresent = (blockValue: number): boolean => {
  return blockValue !== 0;
};

export const isPreview = (blockValue: number): boolean => {
  return (blockValue & PREVIEW_BIT_MASK) !== 0;
};

export const setPreviewBit = (blockValue: number): number => {
  return blockValue | PREVIEW_BIT_MASK;
};

export const clearPreviewBit = (blockValue: number): number => {
  return blockValue & CLEAR_PREVIEW_BIT_MASK;
};

export const encodeBlockData = (
  blockType: number,
  rotation: number
): number => {
  return (blockType << BLOCK_TYPE_SHIFT) | (rotation & ROTATION_MASK);
};

export const getRotation = (blockValue: number): number => {
  return blockValue & ROTATION_MASK;
};

/**
 * Decompress RLE-compressed voxel data
 * Input: Uint16Array with format [voxel_low16, voxel_high16, run_length, ...]
 * Output: Uint32Array of decompressed voxel data
 */
export const decompressVoxelData = (
  compressedData: Uint16Array | number[]
): Uint32Array => {
  const data = Array.isArray(compressedData)
    ? compressedData
    : new Array(compressedData.length);
  if (!Array.isArray(compressedData)) {
    for (let i = 0; i < compressedData.length; i++) {
      data[i] = compressedData[i];
    }
  }

  if (data.length % 3 !== 0) {
    throw new Error(
      "Compressed data must be in triplets (valueLow, valueHigh, count)"
    );
  }

  const decompressed: number[] = [];

  for (let i = 0; i < data.length; i += 3) {
    const valueLow = data[i];
    const valueHigh = data[i + 1];
    const runLength = data[i + 2];

    // Reconstruct 32-bit value from two 16-bit values
    const value = (valueLow & 0xffff) | ((valueHigh & 0xffff) << 16);

    for (let j = 0; j < runLength; j++) {
      decompressed.push(value);
    }
  }

  return new Uint32Array(decompressed);
};

/**
 * Get a specific voxel value from compressed data without fully decompressing
 */
export const getVoxelAt = (
  compressedData: Uint16Array | number[],
  voxelIndex: number
): number => {
  const data = Array.isArray(compressedData)
    ? compressedData
    : new Array(compressedData.length);
  if (!Array.isArray(compressedData)) {
    for (let i = 0; i < compressedData.length; i++) {
      data[i] = compressedData[i];
    }
  }

  if (data.length % 3 !== 0) {
    throw new Error(
      "Compressed data must be in triplets (valueLow, valueHigh, count)"
    );
  }

  if (voxelIndex < 0) {
    throw new Error("Voxel index must be non-negative");
  }

  let currentVoxelIndex = 0;

  for (let i = 0; i < data.length; i += 3) {
    const valueLow = data[i];
    const valueHigh = data[i + 1];
    const runLength = data[i + 2];

    if (voxelIndex < currentVoxelIndex + runLength) {
      // Reconstruct 32-bit value from two 16-bit values
      return (valueLow & 0xffff) | ((valueHigh & 0xffff) << 16);
    }

    currentVoxelIndex += runLength;
  }

  throw new Error("Voxel index is beyond the compressed data range");
};
