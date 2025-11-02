import LZ4 from "lz4js";

/**
 * In the new format, voxels are simply block indices where 0 means empty.
 * No more bit packing for preview, selection, rotation, or version.
 */

/**
 * Get the block type (which is now just the voxel value itself)
 */
export const getBlockType = (blockValue: number): number => {
  return blockValue;
};

/**
 * Check if a block is present (non-zero)
 */
export const isBlockPresent = (blockValue: number): boolean => {
  return blockValue !== 0;
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

const rleCompress = (voxelData: Uint8Array | number[]): Uint8Array => {
  const data = Array.isArray(voxelData) ? voxelData : Array.from(voxelData);

  if (data.length === 0) {
    throw new Error("Voxel data must not be empty");
  }

  const runCount = countRuns(data);
  const totalSize = 4 + runCount * 3;
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

    compressed[writeIndex] = value & 0xff;
    compressed[writeIndex + 1] = runLength & 0xff;
    compressed[writeIndex + 2] = (runLength >> 8) & 0xff;

    writeIndex += 3;
    i = j;
  }

  return compressed;
};

const rleDecompress = (rleData: Uint8Array): Uint8Array => {
  const originalLength =
    rleData[0] | (rleData[1] << 8) | (rleData[2] << 16) | (rleData[3] << 24);

  const decompressed = new Uint8Array(originalLength);
  rleDecompressInto(rleData, decompressed);
  return decompressed;
};

const rleDecompressInto = (rleData: Uint8Array, target: Uint8Array): void => {
  const originalLength =
    rleData[0] | (rleData[1] << 8) | (rleData[2] << 16) | (rleData[3] << 24);

  const dataStartIndex = 4;

  if ((rleData.length - dataStartIndex) % 3 !== 0) {
    throw new Error("RLE data must be in 3-byte groups");
  }

  if (target.length !== originalLength) {
    throw new Error(
      `Target buffer length (${target.length}) does not match expected length (${originalLength})`
    );
  }

  let writeIndex = 0;

  for (let i = dataStartIndex; i < rleData.length; i += 3) {
    const value = rleData[i];
    const runLength = rleData[i + 1] | (rleData[i + 2] << 8);

    for (let j = 0; j < runLength; j++) {
      target[writeIndex++] = value;
    }
  }
};

export const compressVoxelData = (
  voxelData: Uint8Array | number[]
): Uint8Array => {
  const rleCompressed = rleCompress(voxelData);

  const lz4Compressed = LZ4.compress(rleCompressed);

  return new Uint8Array(lz4Compressed);
};

export const decompressVoxelData = (
  compressedData: Uint8Array | number[]
): Uint8Array => {
  const data =
    compressedData instanceof Uint8Array
      ? compressedData
      : new Uint8Array(compressedData);

  const rleData = LZ4.decompress(data);

  return rleDecompress(new Uint8Array(rleData));
};

/**
 * Decompresses voxel data into an existing Uint8Array buffer.
 * This avoids allocating a new buffer when you already have one to reuse.
 * 
 * @param compressedData - The compressed voxel data
 * @param target - The target buffer to decompress into (must be the correct size)
 * @throws Error if the target buffer size doesn't match the decompressed data size
 */
export const decompressVoxelDataInto = (
  compressedData: Uint8Array | number[],
  target: Uint8Array
): void => {
  const data =
    compressedData instanceof Uint8Array
      ? compressedData
      : new Uint8Array(compressedData);

  const rleData = LZ4.decompress(data);

  rleDecompressInto(new Uint8Array(rleData), target);
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
