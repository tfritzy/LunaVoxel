export const BLOCK_TYPE_MASK = 0x7F;
export const NON_RAYCASTABLE_BIT = 0x80;

export const getBlockType = (voxelValue: number): number => {
  return voxelValue & BLOCK_TYPE_MASK;
};

export const isBlockVisible = (voxelValue: number): boolean => {
  return (voxelValue & BLOCK_TYPE_MASK) !== 0;
};

export const isBlockRaycastable = (voxelValue: number): boolean => {
  return (voxelValue & NON_RAYCASTABLE_BIT) === 0 && (voxelValue & BLOCK_TYPE_MASK) !== 0;
};

export const setNonRaycastable = (voxelValue: number): number => {
  return voxelValue | NON_RAYCASTABLE_BIT;
};

export const faces = [
  {
    vertices: [
      [0.5, 0.5, -0.5],
      [0.5, 0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, -0.5, -0.5],
    ],
    normal: [1, 0, 0],
    offset: [1, 0, 0],
  },
  {
    vertices: [
      [-0.5, 0.5, 0.5],
      [-0.5, 0.5, -0.5],
      [-0.5, -0.5, -0.5],
      [-0.5, -0.5, 0.5],
    ],
    normal: [-1, 0, 0],
    offset: [-1, 0, 0],
  },
  {
    vertices: [
      [-0.5, 0.5, -0.5],
      [-0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
      [0.5, 0.5, -0.5],
    ],
    normal: [0, 1, 0],
    offset: [0, 1, 0],
  },
  {
    vertices: [
      [-0.5, -0.5, 0.5],
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, -0.5, 0.5],
    ],
    normal: [0, -1, 0],
    offset: [0, -1, 0],
  },
  {
    vertices: [
      [0.5, 0.5, 0.5],
      [-0.5, 0.5, 0.5],
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
    ],
    normal: [0, 0, 1],
    offset: [0, 0, 1],
  },
  {
    vertices: [
      [-0.5, 0.5, -0.5],
      [0.5, 0.5, -0.5],
      [0.5, -0.5, -0.5],
      [-0.5, -0.5, -0.5],
    ],
    normal: [0, 0, -1],
    offset: [0, 0, -1],
  },
];
