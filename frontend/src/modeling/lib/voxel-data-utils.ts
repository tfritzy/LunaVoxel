import LZ4 from "lz4js";

export const PREVIEW_BIT_MASK = 0x08;
export const BLOCK_TYPE_SHIFT = 6;
export const BLOCK_TYPE_MASK = 0x3ff;
export const ROTATION_MASK = 0x07;
export const CLEAR_PREVIEW_BIT_MASK = 0xfffffff7;

export const VERSION_SHIFT = 16;
export const VERSION_MASK = 0xff;
export const CLEAR_VERSION_MASK = 0xff00ffff;

export const getBlockType = (blockValue: number): number => {
  return (blockValue >> BLOCK_TYPE_SHIFT) & BLOCK_TYPE_MASK;
};

export const setBlockType = (
  blockValue: number,
  newBlockType: number
): number => {
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
  rotation: number,
  version?: number
): number => {
  const wrappedBlockType = blockType & BLOCK_TYPE_MASK;
  const wrappedRotation = rotation & ROTATION_MASK;
  let wrappedVersion = (version ?? 1) & VERSION_MASK;
  if (wrappedVersion === 0) wrappedVersion = 1;
  return (
    (wrappedBlockType << BLOCK_TYPE_SHIFT) |
    wrappedRotation |
    (wrappedVersion << VERSION_SHIFT)
  );
};

export const getRotation = (blockValue: number): number => {
  return blockValue & ROTATION_MASK;
};

export const getVersion = (blockValue: number): number => {
  return (blockValue >>> VERSION_SHIFT) & VERSION_MASK;
};

export const setVersion = (blockValue: number, version: number): number => {
  return (
    (blockValue & CLEAR_VERSION_MASK) |
    ((version & VERSION_MASK) << VERSION_SHIFT)
  );
};

const countRuns = (data: number[]): number => {
  let runCount = 0;
  let i = 0;
  while (i < data.length) {
    const value = data[i];
    let runLength = 1;
    let j = i + 1;

    while (j < data.length && data[j] === value && runLength < 0xffff) {
      runLength++;
      j++;
    }

    runCount++;
    i = j;
  }
  return runCount;
};

const rleCompress = (voxelData: Uint32Array | number[]): Uint8Array => {
  const data = Array.isArray(voxelData) ? voxelData : Array.from(voxelData);

  if (data.length === 0) {
    throw new Error("Voxel data must not be empty");
  }

  const runCount = countRuns(data);
  const totalSize = 4 + runCount * 6;
  const compressed = new Uint8Array(totalSize);

  const originalLength = data.length;
  compressed[0] = originalLength & 0xff;
  compressed[1] = (originalLength >> 8) & 0xff;
  compressed[2] = (originalLength >> 16) & 0xff;
  compressed[3] = (originalLength >> 24) & 0xff;

  let writeIndex = 4;
  let i = 0;
  while (i < data.length) {
    const value = data[i];
    let runLength = 1;
    let j = i + 1;

    while (j < data.length && data[j] === value && runLength < 0xffff) {
      runLength++;
      j++;
    }

    const valueLow = value & 0xffff;
    const valueHigh = (value >> 16) & 0xffff;

    compressed[writeIndex] = valueLow & 0xff;
    compressed[writeIndex + 1] = (valueLow >> 8) & 0xff;
    compressed[writeIndex + 2] = valueHigh & 0xff;
    compressed[writeIndex + 3] = (valueHigh >> 8) & 0xff;
    compressed[writeIndex + 4] = runLength & 0xff;
    compressed[writeIndex + 5] = (runLength >> 8) & 0xff;

    writeIndex += 6;
    i = j;
  }

  return compressed;
};

const rleDecompress = (rleData: Uint8Array): Uint32Array => {
  const originalLength =
    rleData[0] | (rleData[1] << 8) | (rleData[2] << 16) | (rleData[3] << 24);

  const dataStartIndex = 4;

  if ((rleData.length - dataStartIndex) % 6 !== 0) {
    throw new Error("RLE data must be in 6-byte groups");
  }

  const decompressed = new Uint32Array(originalLength);
  let writeIndex = 0;

  for (let i = dataStartIndex; i < rleData.length; i += 6) {
    const valueLow = rleData[i] | (rleData[i + 1] << 8);
    const valueHigh = rleData[i + 2] | (rleData[i + 3] << 8);
    const runLength = rleData[i + 4] | (rleData[i + 5] << 8);

    const value = (valueLow & 0xffff) | ((valueHigh & 0xffff) << 16);

    for (let j = 0; j < runLength; j++) {
      decompressed[writeIndex++] = value;
    }
  }

  return decompressed;
};

export const compressVoxelData = (
  voxelData: Uint32Array | number[]
): Uint8Array => {
  const rleCompressed = rleCompress(voxelData);

  const lz4Compressed = LZ4.compress(rleCompressed);

  return new Uint8Array(lz4Compressed);
};

export const decompressVoxelData = (
  compressedData: Uint8Array | number[]
): Uint32Array => {
  const data =
    compressedData instanceof Uint8Array
      ? compressedData
      : new Uint8Array(compressedData);

  const rleData = LZ4.decompress(data);

  return rleDecompress(new Uint8Array(rleData));
};

export const getVoxelAt = (
  compressedData: Uint8Array | number[],
  voxelIndex: number
): number => {
  if (voxelIndex < 0) {
    throw new Error("Voxel index must be non-negative");
  }

  const decompressedData = decompressVoxelData(compressedData);

  if (voxelIndex >= decompressedData.length) {
    throw new Error("Voxel index is beyond the data range");
  }

  return decompressedData[voxelIndex];
};

/**
 * Decompresses selection data using the NormalCompression format:
 * 1. LZ4 decompression
 * 2. Run-length decoding (count: 2 bytes + value: 4 bytes per run)
 */
export const decompressSelectionData = (
  compressedData: Uint8Array | number[]
): Uint32Array => {
  const data =
    compressedData instanceof Uint8Array
      ? compressedData
      : new Uint8Array(compressedData);

  // First decompress LZ4
  const rleData = LZ4.decompress(data);
  const rleBytes = new Uint8Array(rleData);

  // Then decompress RLE (NormalCompression format)
  const decoded: number[] = [];

  for (let i = 0; i < rleBytes.length; i += 6) {
    // Read count (2 bytes, little-endian)
    const count = rleBytes[i] | (rleBytes[i + 1] << 8);

    // Read value (4 bytes, little-endian)
    const value =
      rleBytes[i + 2] |
      (rleBytes[i + 3] << 8) |
      (rleBytes[i + 4] << 16) |
      (rleBytes[i + 5] << 24);

    // Add the value 'count' times
    for (let j = 0; j < count; j++) {
      decoded.push(value >>> 0); // Ensure unsigned 32-bit
    }
  }

  return new Uint32Array(decoded);
};
