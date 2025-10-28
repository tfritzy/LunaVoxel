import LZ4 from "lz4js";
import { decompressVoxelData as wasmDecompressVoxelData } from "@/wasm/vector3_wasm";

export const PREVIEW_BIT_MASK = 0x08;
export const SELECTED_BIT_MASK = 0x10;
export const BLOCK_TYPE_SHIFT = 6;
export const BLOCK_TYPE_MASK = 0x3ff;
export const ROTATION_MASK = 0x07;
export const CLEAR_PREVIEW_BIT_MASK = 0xfffffff7;
export const CLEAR_SELECTED_BIT_MASK = 0xffffffef;

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

export const isSelected = (blockValue: number): boolean => {
  return (blockValue & SELECTED_BIT_MASK) !== 0;
};

export const setSelectedBit = (blockValue: number): number => {
  return blockValue | SELECTED_BIT_MASK;
};

export const clearSelectedBit = (blockValue: number): number => {
  return blockValue & CLEAR_SELECTED_BIT_MASK;
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

  // Use WASM decompression which handles lz4_flex format correctly
  return wasmDecompressVoxelData(data);
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
