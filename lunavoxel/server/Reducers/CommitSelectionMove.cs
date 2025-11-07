using SpacetimeDB;
using System;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void CommitSelectionMove(ReducerContext ctx, string projectId)
    {
        var selection = ctx.Db.selections.Identity_ProjectId.Filter((ctx.Sender, projectId)).FirstOrDefault();
        if (selection == null)
        {
            return;
        }

        var layer = ctx.Db.layer.project_index.Filter((projectId, selection.Layer)).FirstOrDefault()
            ?? throw new ArgumentException($"Layer not found for project {projectId} at index {selection.Layer}");

        var selectionData = VoxelCompression.Decompress(selection.SelectionData);
        
        // Commit converts position mappings: voxels move from their current temp positions
        // to become "selected at their new position". This involves:
        // 1. Finding all target positions
        // 2. Creating new bounds that encompass all targets
        // 3. Rebuilding selection data with voxels at their target positions
        
        // Find min/max of all target positions
        int minX = int.MaxValue, minY = int.MaxValue, minZ = int.MaxValue;
        int maxX = int.MinValue, maxY = int.MinValue, maxZ = int.MinValue;
        
        for (int i = 0; i < selectionData.Length; i++)
        {
            if (selectionData[i] != 0)
            {
                int targetPosition = selectionData[i] - 1;
                
                int z = targetPosition % layer.zDim;
                int y = (targetPosition / layer.zDim) % layer.yDim;
                int x = targetPosition / (layer.yDim * layer.zDim);
                
                minX = Math.Min(minX, x);
                minY = Math.Min(minY, y);
                minZ = Math.Min(minZ, z);
                maxX = Math.Max(maxX, x);
                maxY = Math.Max(maxY, y);
                maxZ = Math.Max(maxZ, z);
            }
        }
        
        if (minX == int.MaxValue)
        {
            // No selected voxels, shouldn't happen but handle gracefully
            return;
        }
        
        // Create new bounds (MaxPos is exclusive)
        var newMinPos = new Vector3(minX, minY, minZ);
        var newMaxPos = new Vector3(maxX + 1, maxY + 1, maxZ + 1);
        var newDimensions = new Vector3(
            newMaxPos.X - newMinPos.X,
            newMaxPos.Y - newMinPos.Y,
            newMaxPos.Z - newMinPos.Z
        );
        
        // Create new selection data array for the new bounds
        var newSelectionData = new byte[newDimensions.X * newDimensions.Y * newDimensions.Z];
        
        // Map voxels to their target positions within new bounds
        for (int i = 0; i < selectionData.Length; i++)
        {
            if (selectionData[i] != 0)
            {
                int targetPosition = selectionData[i] - 1;
                
                // Convert layer-space position to world coordinates
                int worldZ = targetPosition % layer.zDim;
                int worldY = (targetPosition / layer.zDim) % layer.yDim;
                int worldX = targetPosition / (layer.yDim * layer.zDim);
                
                // Convert to new bounds-local coordinates
                int localX = worldX - newMinPos.X;
                int localY = worldY - newMinPos.Y;
                int localZ = worldZ - newMinPos.Z;
                
                // Calculate index in new selection data
                int newIndex = localX * newDimensions.Y * newDimensions.Z + localY * newDimensions.Z + localZ;
                
                // Store the target position (1-indexed)
                newSelectionData[newIndex] = (byte)(targetPosition + 1);
            }
        }
        
        selection.MinPos = newMinPos;
        selection.MaxPos = newMaxPos;
        selection.SelectionData = VoxelCompression.Compress(newSelectionData);
        ctx.Db.selections.Id.Update(selection);
    }
}
