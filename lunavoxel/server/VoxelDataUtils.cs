using System;

public static class VoxelDataUtils
{
    public const uint ROTATION_MASK = 0x07;              // Bits 0-2: Rotation (3 bits)
    public const uint IS_PREVIEW_MASK = 0x08;            // Bit 3: Preview flag
    public const uint TYPE_MASK = 0x3FF;                 // Bits 6-15: Block type (10 bits)
    public const int TYPE_SHIFT = 6;                    // Shift for type bits
    public const uint CLEAR_PREVIEW_MASK = 0xFFFFFFF7;   // Clear preview bit mask

    /// <summary>
    /// Extract block type from voxel data
    /// </summary>
    public static int GetBlockType(uint voxelData)
    {
        return (int)((voxelData >> TYPE_SHIFT) & TYPE_MASK);
    }

    /// <summary>
    /// Extract rotation from voxel data
    /// </summary>
    public static int GetRotation(uint voxelData)
    {
        return (int)(voxelData & ROTATION_MASK);
    }

    /// <summary>
    /// Check if voxel is marked as preview
    /// </summary>
    public static bool IsPreview(uint voxelData)
    {
        return (voxelData & IS_PREVIEW_MASK) != 0;
    }

    /// <summary>
    /// Check if block is present (non-zero)
    /// </summary>
    public static bool IsBlockPresent(uint voxelData)
    {
        return voxelData != 0;
    }

    /// <summary>
    /// Set preview bit on voxel data
    /// </summary>
    public static uint SetPreviewBit(uint voxelData)
    {
        return voxelData | IS_PREVIEW_MASK;
    }

    /// <summary>
    /// Clear preview bit on voxel data
    /// </summary>
    public static uint ClearPreviewBit(uint voxelData)
    {
        return voxelData & CLEAR_PREVIEW_MASK;
    }

    /// <summary>
    /// Encode block data from type and rotation
    /// </summary>
    public static uint EncodeBlockData(int blockType, int rotation)
    {
        return (uint)((blockType << TYPE_SHIFT) | (rotation & (int)ROTATION_MASK));
    }
}