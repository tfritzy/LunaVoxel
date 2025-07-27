using SpacetimeDB;
using static Module;

public static class UndoRedo
{
    public static void AddEntry(
        ReducerContext ctx,
        string projectId,
        string layerId,
        byte[] beforeVoxels,
        byte[] afterVoxels)
    {
        var author = ctx.Sender;
        var headEntry = ctx.Db.layer_history_entry.author_head.Filter((author, true)).FirstOrDefault();

        var undoneEntries = ctx.Db.layer_history_entry.author_undone.Filter((ctx.Sender, true)).ToList();
        foreach (var entry in undoneEntries)
        {
            ctx.Db.layer_history_entry.Delete(entry);
        }

        var diff = XorExpandedLayers(
            VoxelRLE.Decompress(beforeVoxels),
            VoxelRLE.Decompress(afterVoxels));
        LayerHistoryEntry newEntry = LayerHistoryEntry.Build(
            projectId,
            author,
            layerId,
            beforeVoxels,
            VoxelRLE.Compress(diff),
            true);
        ctx.Db.layer_history_entry.Insert(newEntry);

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
        entries.Sort((l1, l2) => l1.Version.CompareTo(l2.Version));

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
        oldHead.IsUndone = true;
        newHead.IsHead = true;

        ctx.Db.layer_history_entry.Id.Update(oldHead);
        ctx.Db.layer_history_entry.Id.Update(newHead);

        var oldHeadVoxels = VoxelRLE.Decompress(oldHead.BeforeVoxels);

        var editsOfLayer = entries.FindAll(e => e.LayerId == oldHead.LayerId);
        var oldHeadIndex = editsOfLayer.FindIndex(e => e.Id == oldHead.Id);
        var diff = VoxelDataToDictionary(VoxelRLE.Decompress(oldHead.DiffVoxels));

        for (int i = oldHeadIndex + 1; i < editsOfLayer.Count; i++)
        {
            var edit = editsOfLayer[i];
            if (edit.Author == author)
            {
                continue;
            }

            var expandedLayerData = VoxelRLE.Decompress(edit.BeforeVoxels);
            bool wasChanged = false;
            var itemsToRemove = new List<int>();

            foreach (var kvp in diff)
            {
                var byteIndex = kvp.Key;
                var voxelData = kvp.Value;

                if (byteIndex + 1 < expandedLayerData.Length)
                {
                    if (expandedLayerData[byteIndex] == voxelData[0]
                        && expandedLayerData[byteIndex + 1] == voxelData[1])
                    {
                        expandedLayerData[byteIndex] = oldHeadVoxels[byteIndex];
                        expandedLayerData[byteIndex + 1] = oldHeadVoxels[byteIndex + 1];
                        wasChanged = true;
                    }
                    else
                    {
                        itemsToRemove.Add(byteIndex);
                    }
                }
                else
                {
                    itemsToRemove.Add(byteIndex);
                }
            }

            foreach (var key in itemsToRemove)
            {
                diff.Remove(key);
            }

            if (wasChanged)
            {
                edit.BeforeVoxels = VoxelRLE.Compress(expandedLayerData);
                ctx.Db.layer_history_entry.Id.Update(edit);
            }
        }

        var newHighestEdit = editsOfLayer.FindLast(e => !e.IsUndone);
        var currentLayerState = ctx.Db.layer.Id.Find(oldHead.LayerId);
        if (currentLayerState == null) return;
        currentLayerState.Voxels = VoxelRLE.Compress(ApplyDiff(
            VoxelRLE.Decompress(newHighestEdit.BeforeVoxels),
            VoxelRLE.Decompress(newHighestEdit.DiffVoxels)));
        ctx.Db.layer.Id.Update(currentLayerState);
    }

    public static byte[] XorExpandedLayers(byte[] layer1, byte[] layer2)
    {
        if (layer1 == null || layer2 == null)
            throw new ArgumentNullException();

        if (layer1.Length != layer2.Length)
            throw new ArgumentException("Layers must have the same length");

        if (layer1.Length % 2 != 0)
            throw new ArgumentException("Layer length must be divisible by 2");

        var result = new byte[layer1.Length];

        for (int i = 0; i < layer1.Length; i += 2)
        {
            byte xor1 = (byte)(layer1[i] ^ layer2[i]);
            byte xor2 = (byte)(layer1[i + 1] ^ layer2[i + 1]);

            if (xor1 != 0 || xor2 != 0)
            {
                result[i] = layer2[i];
                result[i + 1] = layer2[i + 1];
            }
        }

        return result;
    }

    public static Dictionary<int, byte[]> VoxelDataToDictionary(byte[] voxelData)
    {
        if (voxelData == null)
            throw new ArgumentNullException(nameof(voxelData));

        if (voxelData.Length % 2 != 0)
            throw new ArgumentException("Voxel data length must be divisible by 2");

        var result = new Dictionary<int, byte[]>();

        for (int i = 0; i < voxelData.Length; i += 2)
        {
            if (voxelData[i] != 0 || voxelData[i + 1] != 0)
            {
                result[i] = new byte[] { voxelData[i], voxelData[i + 1] };
            }
        }

        return result;
    }

    public static byte[] ApplyDiff(byte[] beforeVoxels, byte[] diff)
    {
        if (beforeVoxels == null || diff == null)
            throw new ArgumentNullException();

        if (beforeVoxels.Length != diff.Length)
            throw new ArgumentException("Before voxels and diff must have the same length");

        var result = new byte[beforeVoxels.Length];
        Array.Copy(beforeVoxels, result, beforeVoxels.Length);

        for (int i = 0; i < diff.Length; i += 2)
        {
            if (diff[i] != 0 || diff[i + 1] != 0)
            {
                result[i] = diff[i];
                result[i + 1] = diff[i + 1];
            }
        }

        return result;
    }
}