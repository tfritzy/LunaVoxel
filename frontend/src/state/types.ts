import type { VoxelFrame } from "@/modeling/lib/voxel-frame";

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
  dimensions: Vector3;
};

export type AccessLevel = {
  tag: "ReadWrite" | "Read" | "None";
};

export type VoxelObject = {
  id: string;
  projectId: string;
  name: string;
  visible: boolean;
  locked: boolean;
  position: Vector3;
  dimensions: Vector3;
};

export type ProjectBlocks = {
  projectId: string;
  colors: number[];
};

export type ChunkData = {
  key: string;
  projectId: string;
  objectId: string;
  minPos: Vector3;
  size: Vector3;
  voxels: Uint8Array;
  selection: VoxelFrame;
};
