import { CHUNK_SIZE } from "@/state/constants";
import type { Vector3 } from "@/state/types";

export const getChunkKey = (objectId: string, minPos: Vector3) =>
  `${objectId}:${minPos.x},${minPos.y},${minPos.z}`;

export const getChunkPosKey = (minPos: Vector3) =>
  `${minPos.x},${minPos.y},${minPos.z}`;

export const getChunkMinPos = (worldPos: Vector3): Vector3 => ({
  x: Math.floor(worldPos.x / CHUNK_SIZE) * CHUNK_SIZE,
  y: Math.floor(worldPos.y / CHUNK_SIZE) * CHUNK_SIZE,
  z: Math.floor(worldPos.z / CHUNK_SIZE) * CHUNK_SIZE,
});

export function getBlockAt(
  chunks: Map<string, { size: Vector3; voxels: Uint8Array }>,
  objectId: string,
  wx: number,
  wy: number,
  wz: number,
): number {
  const cx = Math.floor(wx / CHUNK_SIZE) * CHUNK_SIZE;
  const cy = Math.floor(wy / CHUNK_SIZE) * CHUNK_SIZE;
  const cz = Math.floor(wz / CHUNK_SIZE) * CHUNK_SIZE;
  const key = getChunkKey(objectId, { x: cx, y: cy, z: cz });
  const chunk = chunks.get(key);
  if (!chunk) return 0;
  const lx = wx - cx;
  const ly = wy - cy;
  const lz = wz - cz;
  return chunk.voxels[lx * chunk.size.y * chunk.size.z + ly * chunk.size.z + lz];
}
