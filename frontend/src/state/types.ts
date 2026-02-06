export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type BlockModificationMode =
  | { tag: "Attach" }
  | { tag: "Erase" }
  | { tag: "Paint" };

export const BlockModificationMode = {
  Attach: { tag: "Attach" } as const,
  Erase: { tag: "Erase" } as const,
  Paint: { tag: "Paint" } as const,
};

export type Layer = {
  id: string;
  xDim: number;
  yDim: number;
  zDim: number;
  index: number;
  visible: boolean;
  locked: boolean;
  name: string;
};

export type Chunk = {
  id: string;
  layerId: string;
  minPosX: number;
  minPosY: number;
  minPosZ: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  voxels: Uint8Array;
};

export type VoxelFrameData = {
  minPos: Vector3;
  dimensions: Vector3;
  voxelData: Uint8Array;
};

export type Selection = {
  id: string;
  identityId: string;
  layer: number;
  selectionFrames: VoxelFrameData[];
};
