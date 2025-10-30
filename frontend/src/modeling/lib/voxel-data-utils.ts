import LZ4 from "lz4js";
import { decompressVoxelData as wasmDecompressVoxelData } from "@/wasm/vector3_wasm";

export const isBlockPresent = (blockValue: number): boolean => {
  return blockValue > 0;
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
  const totalSize = 4 + runCount * 3; // 1 byte for value + 2 bytes for run length
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

  // Use WASM decompression which handles lz4_flex format correctly
  const result = wasmDecompressVoxelData(data);
  // Convert to Uint8Array if it's not already
  return result instanceof Uint8Array ? result : new Uint8Array(result);
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
