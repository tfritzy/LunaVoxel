using System;

public static class VoxelDataUtils
{
    public const uint ROTATION_MASK = 0x07;              // Bits 0-2: Rotation (3 bits)
    public const uint IS_PREVIEW_MASK = 0x08;            // Bit 3: Preview flag
    public const uint TYPE_MASK = 0x3FF;                 // Bits 6-15: Block type (10 bits)
    public const int TYPE_SHIFT = 6;                     // Shift for type bits
    public const uint CLEAR_PREVIEW_MASK = 0xFFFFFFF7;   // Clear preview bit mask
    public const int VERSION_SHIFT = 16;
    public const uint VERSION_MASK = 0xFF;               // 8-bit version, used after shift
    public const uint CLEAR_VERSION_MASK = 0xFF00FFFF;   // Clear bits 16-23

    /// <summary>
    /// Extract block type from voxel data
    /// </summary>
    public static uint GetBlockType(uint voxelData)
    {
        return (voxelData >> TYPE_SHIFT) & TYPE_MASK;
    }

    /// <summary>
    /// Extract rotation from voxel data
    /// </summary>
    public static uint GetRotation(uint voxelData)
    {
        return voxelData & ROTATION_MASK;
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
    /// Encode block data from type, rotation, and version
    /// </summary>
    public static uint EncodeBlockData(uint blockType, uint rotation, uint version)
    {
        uint wrappedBlockType = blockType & TYPE_MASK;
        uint wrappedRotation = rotation & ROTATION_MASK;
        uint wrappedVersion = version & VERSION_MASK;

        if (wrappedVersion == 0)
        {
            wrappedVersion = 1;
        }

        return (wrappedBlockType << TYPE_SHIFT) | wrappedRotation | (wrappedVersion << VERSION_SHIFT);
    }

    /// <summary>
    /// Extract version (bits 16-23) from voxel data.
    /// </summary>
    public static uint GetVersion(uint voxelData)
    {
        return (voxelData >> VERSION_SHIFT) & VERSION_MASK;
    }

    /// <summary>
    /// Set version (bits 16-23) in voxel data. Does not affect other fields.
    /// </summary>
    public static uint SetVersion(uint voxelData, uint version)
    {
        // Clear existing version bits, then set new version (masked to 8 bits)
        voxelData &= CLEAR_VERSION_MASK;
        return voxelData | (version & VERSION_MASK) << VERSION_SHIFT;
    }
}