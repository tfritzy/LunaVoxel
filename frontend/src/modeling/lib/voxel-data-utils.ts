export const PREVIEW_BIT_MASK = 0x08;
export const BLOCK_TYPE_SHIFT = 6;
export const BLOCK_TYPE_MASK = 0x3ff;
export const ROTATION_MASK = 0x07;
export const CLEAR_PREVIEW_BIT_MASK = 0xfffffff7;

export const getBlockType = (blockValue: number): number => {
  return (blockValue >> BLOCK_TYPE_SHIFT) & BLOCK_TYPE_MASK;
};

export const setBlockType = (blockValue: number, newBlockType: number): number => {
  const clearedValue = blockValue & ~(BLOCK_TYPE_MASK << BLOCK_TYPE_SHIFT);
  return clearedValue | ((newBlockType & BLOCK_TYPE_MASK) << BLOCK_TYPE_SHIFT);
};

export const isBlockPresent = (blockValue: number): boolean => {
  return getBlockType(blockValue) != 0;
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

export const compressVoxelData = (voxelData: Uint32Array | number[]): Uint8Array => {
  const data = Array.isArray(voxelData) ? voxelData : Array.from(voxelData);

  if (data.length === 0) {
    throw new Error("Voxel data must not be empty");
  }

  const compressed: number[] = [];
  let i = 0;

  while (i < data.length) {
    const value = data[i];
    let runLength = 1;
    let j = i + 1;

    while (j < data.length &&
      data[j] === value &&
      runLength < 0xFFFF) {
      runLength++;
      j++;
    }

    const valueLow = value & 0xFFFF;
    const valueHigh = (value >> 16) & 0xFFFF;

    compressed.push(valueLow & 0xFF);
    compressed.push((valueLow >> 8) & 0xFF);
    compressed.push(valueHigh & 0xFF);
    compressed.push((valueHigh >> 8) & 0xFF);
    compressed.push(runLength & 0xFF);
    compressed.push((runLength >> 8) & 0xFF);

    i = j;
  }

  return new Uint8Array(compressed);
};

export const decompressVoxelData = (
  compressedData: Uint8Array | number[]
): Uint32Array => {
  const data = Array.isArray(compressedData)
    ? compressedData
    : new Array(compressedData.length);
  if (!Array.isArray(compressedData)) {
    for (let i = 0; i < compressedData.length; i++) {
      data[i] = compressedData[i];
    }
  }

  if (data.length % 6 !== 0) {
    throw new Error(
      "Compressed data must be in 6-byte groups (valueLow_bytes, valueHigh_bytes, runLength_bytes)"
    );
  }

  const decompressed: number[] = [];

  for (let i = 0; i < data.length; i += 6) {
    const valueLow = data[i] | (data[i + 1] << 8);
    const valueHigh = data[i + 2] | (data[i + 3] << 8);
    const runLength = data[i + 4] | (data[i + 5] << 8);

    const value = (valueLow & 0xffff) | ((valueHigh & 0xffff) << 16);

    for (let j = 0; j < runLength; j++) {
      decompressed.push(value);
    }
  }

  return new Uint32Array(decompressed);
};

export const getVoxelAt = (
  compressedData: Uint8Array | number[],
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

  if (data.length % 6 !== 0) {
    throw new Error(
      "Compressed data must be in 6-byte groups (valueLow_bytes, valueHigh_bytes, runLength_bytes)"
    );
  }

  if (voxelIndex < 0) {
    throw new Error("Voxel index must be non-negative");
  }

  let currentVoxelIndex = 0;

  for (let i = 0; i < data.length; i += 6) {
    const valueLow = data[i] | (data[i + 1] << 8);
    const valueHigh = data[i + 2] | (data[i + 3] << 8);
    const runLength = data[i + 4] | (data[i + 5] << 8);

    if (voxelIndex < currentVoxelIndex + runLength) {
      return (valueLow & 0xffff) | ((valueHigh & 0xffff) << 16);
    }

    currentVoxelIndex += runLength;
  }

  throw new Error("Voxel index is beyond the compressed data range");
};
