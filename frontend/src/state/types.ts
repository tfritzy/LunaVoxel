export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type AccessType =
  | { tag: "None" }
  | { tag: "Inherited" }
  | { tag: "Read" }
  | { tag: "ReadWrite" };

export const AccessType = {
  None: { tag: "None" } as const,
  Inherited: { tag: "Inherited" } as const,
  Read: { tag: "Read" } as const,
  ReadWrite: { tag: "ReadWrite" } as const,
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

export type Project = {
  id: string;
  name: string;
  dimensions: Vector3;
  ownerId: string;
  updated: number;
  created: number;
  publicAccess: AccessType;
};

export type Layer = {
  id: string;
  projectId: string;
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
  projectId: string;
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
  projectId: string;
  layer: number;
  selectionFrames: VoxelFrameData[];
};

export type PlayerCursor = {
  id: string;
  projectId: string;
  playerId: string;
  displayName: string;
  position: Vector3;
  normal: Vector3;
  lastUpdated: number;
};

export type UserProject = {
  projectId: string;
  userId: string;
  email: string | null;
  accessType: AccessType;
};

export type User = {
  id: string;
  email: string | null;
  displayName: string | null;
};
