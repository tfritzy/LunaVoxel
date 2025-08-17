export const PREVIEW_BIT_MASK = 0x08;
export const BLOCK_TYPE_SHIFT = 6;
export const BLOCK_TYPE_MASK = 0x3ff;
export const ROTATION_MASK = 0x07;
export const CLEAR_PREVIEW_BIT_MASK = 0xfff7;

export const getBlockType = (blockValue: number): number => {
  return (blockValue >> BLOCK_TYPE_SHIFT) & BLOCK_TYPE_MASK;
};

export const isBlockPresent = (blockValue: number): boolean => {
  return blockValue !== 0;
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

export const encodeBlockData = (
  blockType: number,
  rotation: number
): number => {
  return (blockType << BLOCK_TYPE_SHIFT) | (rotation & ROTATION_MASK);
};

export const getRotation = (blockValue: number): number => {
  return blockValue & ROTATION_MASK;
};
