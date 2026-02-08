import type { SparseVoxelOctree } from "./sparse-voxel-octree";

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type BlockModificationMode = {
  tag: "Attach" | "Erase" | "Paint";
};

export type Project = {
  id: string;
  name: string;
  dimensions: Vector3;
};

export type AccessLevel = {
  tag: "ReadWrite" | "Read" | "None";
};

export type Layer = {
  id: string;
  projectId: string;
  index: number;
  name: string;
  visible: boolean;
  locked: boolean;
};

export type ProjectBlocks = {
  projectId: string;
  faceColors: number[][];
};

export type ChunkData = {
  key: string;
  projectId: string;
  layerId: string;
  minPos: Vector3;
  size: Vector3;
  voxels: SparseVoxelOctree;
};
