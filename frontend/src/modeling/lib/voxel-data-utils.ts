import LZ4 from "lz4js";
import { BLOCK_TYPE_MASK, RAYCASTABLE_BIT } from "./voxel-constants";

/**
 * Voxel format (8 bits):
 * - Bits 0-6: Block type (0-127, where 0 = empty)
 * - Bit 7: Raycastable flag (1 = raycastable, 0 = not raycastable)
 * 
 * This means:
 * - 0x00 (0): Empty, not raycastable (default)
 * - 0x81 (129): Block type 1, raycastable (normal solid block)
 * - 0x01 (1): Block type 1, not raycastable (preview attach block)
 * - 0x80 (128): Block type 0, raycastable (erase preview - invisible but raycastable)
 */

/**
 * Get the block type (bits 0-6)
 */
export const getBlockType = (blockValue: number): number => {
  return blockValue & BLOCK_TYPE_MASK;
};

/**
 * Check if a block is present (has a non-zero block type)
 */
export const isBlockPresent = (blockValue: number): boolean => {
  return (blockValue & BLOCK_TYPE_MASK) !== 0;
};

/**
 * Check if a block is visible (has a block type)
 */
export const isBlockVisible = (blockValue: number): boolean => {
  return (blockValue & BLOCK_TYPE_MASK) !== 0;
};

/**
 * Check if a block is solid (present for collision/occlusion purposes)
 */
export const isBlockSolid = (blockValue: number): boolean => {
  return (blockValue & BLOCK_TYPE_MASK) !== 0;
};

/**
 * Check if a block is raycastable (bit 7 is set)
 */
export const isBlockRaycastable = (blockValue: number): boolean => {
  return (blockValue & RAYCASTABLE_BIT) !== 0;
};

/**
 * Set the raycastable flag on a voxel value
 */
export const setRaycastable = (blockValue: number): number => {
  return blockValue | RAYCASTABLE_BIT;
};

/**
 * Clear the raycastable flag
 */
export const clearRaycastable = (blockValue: number): number => {
  return blockValue & BLOCK_TYPE_MASK;
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
  return rleDecompressInto(rleData, decompressed);
};

const rleDecompressInto = (rleData: Uint8Array, target: Uint8Array): Uint8Array => {
  const originalLength =
    rleData[0] | (rleData[1] << 8) | (rleData[2] << 16) | (rleData[3] << 24);

  const dataStartIndex = 4;

  if ((rleData.length - dataStartIndex) % 3 !== 0) {
    throw new Error("RLE data must be in 3-byte groups");
  }

  // Resize buffer if needed
  let buffer = target;
  if (target.length !== originalLength) {
    buffer = new Uint8Array(originalLength);
  }

  let writeIndex = 0;

  for (let i = dataStartIndex; i < rleData.length; i += 3) {
    const value = rleData[i];
    const runLength = rleData[i + 1] | (rleData[i + 2] << 8);

    for (let j = 0; j < runLength; j++) {
      buffer[writeIndex++] = value;
    }
  }

  return buffer;
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
 * If the buffer size doesn't match, a new buffer of the correct size is allocated.
 * 
 * @param compressedData - The compressed voxel data
 * @param target - The target buffer to decompress into (will be resized if needed)
 * @returns The buffer containing the decompressed data (may be the same buffer or a new one)
 */
export const decompressVoxelDataInto = (
  compressedData: Uint8Array | number[],
  target: Uint8Array
): Uint8Array => {
  const data =
    compressedData instanceof Uint8Array
      ? compressedData
      : new Uint8Array(compressedData);

  const rleData = LZ4.decompress(data);

  return rleDecompressInto(new Uint8Array(rleData), target);
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
