using System;

/// <summary>
/// Utility functions for voxel data manipulation.
/// In the new format, voxels are simply block indices where 0 means empty.
/// Each voxel is 8 bits (byte), allowing up to 256 different block types.
/// </summary>
public static class VoxelDataUtils
{
    /// <summary>
    /// Check if block is present (non-zero block index)
    /// </summary>
    public static bool IsBlockPresent(byte voxelData)
    {
        return voxelData != 0;
    }

    /// <summary>
    /// Get the block index from voxel data (which is now just the block index itself)
    /// </summary>
    public static byte GetBlockType(byte voxelData)
    {
        return voxelData;
    }
}