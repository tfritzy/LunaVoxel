public static partial class Module
{
    /// <summary>
    /// Applies diff data to voxel data based on the modification mode.
    /// </summary>
    /// <param name="voxels">The current voxel data to modify</param>
    /// <param name="diffData">The diff data containing changes</param>
    /// <param name="mode">The modification mode (Attach, Erase, or Paint)</param>
    /// <remarks>
    /// When diffData has a non-zero value:
    /// - Erase mode: Sets voxel to 0 (erase the block)
    /// - Attach mode: Sets voxel to the diffData value (place the block)
    /// - Paint mode: Sets voxel to the diffData value (paint the block)
    /// When diffData has a zero value, no change is made regardless of mode.
    /// </remarks>
    public static void ApplyDiffData(byte[] voxels, byte[] diffData, BlockModificationMode mode)
    {
        for (int i = 0; i < diffData.Length; i++)
        {
            if (diffData[i] != 0)
            {
                // When mode is Erase, a non-zero value in diffData means we should erase (set to 0)
                // For other modes, a non-zero value means we should set it to that value
                voxels[i] = mode == BlockModificationMode.Erase ? (byte)0 : diffData[i];
            }
        }
    }
}
