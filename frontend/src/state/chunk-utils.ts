import { CHUNK_SIZE } from "./constants";
import type { ChunkData, Vector3 } from "./types";

export const chunkMin = (w: number): number =>
  Math.floor(w / CHUNK_SIZE) * CHUNK_SIZE;

export const chunkMinPos = (wx: number, wy: number, wz: number): Vector3 => ({
  x: chunkMin(wx),
  y: chunkMin(wy),
  z: chunkMin(wz),
});

export const voxelIndex = (
  lx: number,
  ly: number,
  lz: number,
  sizeY: number,
  sizeZ: number
): number => lx * sizeY * sizeZ + ly * sizeZ + lz;

export const chunkVoxelIndex = (
  chunk: ChunkData,
  wx: number,
  wy: number,
  wz: number
): number =>
  voxelIndex(
    wx - chunk.minPos.x,
    wy - chunk.minPos.y,
    wz - chunk.minPos.z,
    chunk.size.y,
    chunk.size.z
  );

export const getChunkVoxel = (
  chunk: ChunkData,
  wx: number,
  wy: number,
  wz: number
): number => chunk.voxels[chunkVoxelIndex(chunk, wx, wy, wz)];

export const setChunkVoxel = (
  chunk: ChunkData,
  wx: number,
  wy: number,
  wz: number,
  value: number
): void => {
  chunk.voxels[chunkVoxelIndex(chunk, wx, wy, wz)] = value;
};
