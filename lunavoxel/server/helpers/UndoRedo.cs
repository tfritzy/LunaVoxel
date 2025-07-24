using SpacetimeDB;
using static Module;

public static class UndoRedo
{
    public static void AddEntry(
        ReducerContext ctx,
        string projectId,
        string layerId,
        byte[] voxelData)
    {
        var author = ctx.Sender;
        var headEntry = ctx.Db.layer_history_entry.author_head.Filter((author, true)).FirstOrDefault();
        var entries = ctx.Db.layer_history_entry.project.Filter((projectId)).ToList();
        entries.Sort((l1, l2) => l1.Version - l2.Version);

        // Remove authors entries beyond head.
        var invalidatedEntries = entries.FindAll(e => e.Author == author && e.Version > headEntry?.Version);
        foreach (var entry in invalidatedEntries)
        {
            ctx.Db.layer_history_entry.Delete(entry);
        }
        entries.RemoveAll(e => e.Author == author && e.Version > headEntry?.Version);

        LayerHistoryEntry newEntry = LayerHistoryEntry.Build(
            projectId,
            author,
            layerId,
            entries[^1].Version + 1,
            voxelData,
            true);
        ctx.Db.layer_history_entry.Insert(newEntry);
        entries.Add(newEntry);

        if (headEntry != null)
        {
            headEntry.IsHead = false;
            ctx.Db.layer_history_entry.Id.Update(headEntry);
        }

        // clean up excess versions
    }

    public static void Undo(ReducerContext ctx, string projectId)
    {
        var author = ctx.Sender;
        var entries = ctx.Db.layer_history_entry.project.Filter(projectId).ToList();
        entries.Sort((l1, l2) => l1.Version - l2.Version);

        var authorEdits = entries.FindAll(e => e.Author == author);
        var headIndex = authorEdits.FindIndex(e => e.IsHead);
        if (headIndex <= 0)
        {
            return;
        }

        var newHeadIndex = headIndex - 1;
        var oldHead = authorEdits[headIndex];
        var newHead = authorEdits[headIndex - 1];
        oldHead.IsHead = false;
        newHead.IsHead = true;
        ctx.Db.layer_history_entry.Id.Update(oldHead);
        ctx.Db.layer_history_entry.Id.Update(newHead);

        var editsOfLayer = entries.FindAll(e => e.LayerId == oldHead.LayerId);
        var oldHeadIndex = editsOfLayer.FindIndex(e => e.Id == oldHead.Id);
        if (oldHeadIndex <= 0) return; // Nothing to undo.
        if (oldHeadIndex == editsOfLayer.Count - 1) return; // nothing to remove forward.
        var prevEntry = editsOfLayer[oldHeadIndex - 1];

        var prevEntryVoxels = VoxelRLE.Decompress(prevEntry.Voxels);
        var diff = XorExpandedLayers(
            prevEntryVoxels,
            VoxelRLE.Decompress(oldHead.Voxels));
        for (int i = oldHeadIndex + 1; i < editsOfLayer.Count; i++)
        {
            var layer = editsOfLayer[i];
            var expandedLayerData = VoxelRLE.Decompress(layer.Voxels);
            bool wasChanged = false;
            var itemsToRemove = new List<int>();
            foreach (var kvp in diff)
            {
                var byteIndex = kvp.Key;
                var voxelData = kvp.Value;

                if (expandedLayerData[byteIndex] == voxelData[0]
                    && expandedLayerData[byteIndex + 1] == voxelData[1])
                {
                    expandedLayerData[byteIndex] = prevEntryVoxels[byteIndex];
                    expandedLayerData[byteIndex + 1] = prevEntryVoxels[byteIndex + 1];
                    wasChanged = true;
                }
                else
                {
                    // Voxel was overwritten so it's no longer tied to this entry.
                    itemsToRemove.Add(byteIndex);
                }
            }

            foreach (var key in itemsToRemove)
            {
                diff.Remove(key);
            }

            if (wasChanged)
            {
                layer.Voxels = VoxelRLE.Compress(expandedLayerData);
                ctx.Db.layer_history_entry.Id.Update(layer);
            }
        }

        var currentLayerState = ctx.Db.layer.Id.Find(oldHead.LayerId);
        if (currentLayerState == null) return;
        currentLayerState.Voxels = editsOfLayer[^1].Voxels;
        ctx.Db.layer.Id.Update(currentLayerState);
    }

    public static Dictionary<int, byte[]> XorExpandedLayers(byte[] layer1, byte[] layer2)
    {
        if (layer1 == null || layer2 == null)
            throw new ArgumentNullException();

        if (layer1.Length != layer2.Length)
            throw new ArgumentException("Layers must have the same length");

        if (layer1.Length % 2 != 0)
            throw new ArgumentException("Layer length must be divisible by 2");

        var result = new Dictionary<int, byte[]>();

        for (int i = 0; i < layer1.Length; i += 2)
        {
            byte xor1 = (byte)(layer1[i] ^ layer2[i]);
            byte xor2 = (byte)(layer1[i + 1] ^ layer2[i + 1]);

            if (xor1 != 0 || xor2 != 0)
            {
                result[i] = [layer2[i], layer2[i + 1]];
            }
        }

        return result;
    }
}