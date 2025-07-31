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
    }

    public static void Undo(ReducerContext ctx, string projectId)
    {
        var author = ctx.Sender;
        var entries = ctx.Db.layer_history_entry.project.Filter(projectId).ToList();
        entries.Sort((l1, l2) => l1.Version.CompareTo(l2.Version));

        var authorEdits = entries.FindAll(e => e.Author == author || e.IsBaseState);
        var headIndex = authorEdits.FindLastIndex(e => e.IsHead);
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
        RemoveDiffFromFutureEdits(ctx, editsOfLayer, oldHeadIndex + 1, diff, oldHeadVoxels);

        var newHighestEdit = editsOfLayer.FindLast(e => !e.IsUndone);
        var currentLayerState = ctx.Db.layer.Id.Find(oldHead.LayerId);
        if (currentLayerState == null) return;

        byte[] newLayerVoxels;
        if (newHighestEdit != null)
        {
            newLayerVoxels = ApplyDiff(
                VoxelRLE.Decompress(newHighestEdit.BeforeVoxels),
                VoxelRLE.Decompress(newHighestEdit.DiffVoxels));
        }
        else
        {
            newLayerVoxels = VoxelRLE.Decompress(oldHead.BeforeVoxels);
        }

        currentLayerState.Voxels = VoxelRLE.Compress(newLayerVoxels);
        ctx.Db.layer.Id.Update(currentLayerState);
    }

    public static void Redo(ReducerContext ctx, string projectId)
    {
        var author = ctx.Sender;
        var entries = ctx.Db.layer_history_entry.project.Filter(projectId).ToList();
        entries.Sort((l1, l2) => l1.Version.CompareTo(l2.Version));

        var authorEdits = entries.FindAll(e => e.Author == author || e.IsBaseState);
        var headIndex = authorEdits.FindLastIndex(e => e.IsHead);

        if (headIndex < 0 || headIndex >= authorEdits.Count - 1)
        {
            return;
        }

        var nextEntry = authorEdits[headIndex + 1];
        if (!nextEntry.IsUndone)
        {
            return;
        }

        var currentHead = authorEdits[headIndex];
        currentHead.IsHead = false;
        nextEntry.IsHead = true;
        nextEntry.IsUndone = false;

        ctx.Db.layer_history_entry.Id.Update(currentHead);
        ctx.Db.layer_history_entry.Id.Update(nextEntry);

        var editsOfLayer = entries.FindAll(e => e.LayerId == nextEntry.LayerId);
        var nextEntryIndex = editsOfLayer.FindIndex(e => e.Id == nextEntry.Id);
        var diff = VoxelDataToDictionary(VoxelRLE.Decompress(nextEntry.DiffVoxels));
        var nextEntryBeforeVoxels = VoxelRLE.Decompress(nextEntry.BeforeVoxels);

        AddDiffToFutureEdits(ctx, editsOfLayer, nextEntryIndex + 1, diff, nextEntryBeforeVoxels);

        var currentLayerState = ctx.Db.layer.Id.Find(nextEntry.LayerId);
        if (currentLayerState == null) return;

        var newLayerVoxels = ApplyDiff(
            VoxelRLE.Decompress(nextEntry.BeforeVoxels),
            VoxelRLE.Decompress(nextEntry.DiffVoxels));

        currentLayerState.Voxels = VoxelRLE.Compress(newLayerVoxels);
        ctx.Db.layer.Id.Update(currentLayerState);
    }

    private static void RemoveDiffFromFutureEdits(
        ReducerContext ctx,
        List<LayerHistoryEntry> edits,
        int startIndex,
        Dictionary<int, byte[]> diff,
        byte[] oldHeadVoxels)
    {
        for (int i = startIndex; i < edits.Count; i++)
        {
            var edit = edits[i];
            if (edit.Author == ctx.Sender)
            {
                continue;
            }

            bool wasChanged = false;
            var itemsToRemove = new List<int>();
            byte[] expandedLayerData = null;

            foreach (var kvp in diff)
            {
                var byteIndex = kvp.Key;
                var voxelData = kvp.Value;
                var voxelIndex = byteIndex / 2;

                try
                {
                    var currentVoxel = VoxelRLE.GetVoxelAt(edit.BeforeVoxels, voxelIndex);

                    if (currentVoxel[0] == voxelData[0] && currentVoxel[1] == voxelData[1])
                    {
                        if (expandedLayerData == null)
                        {
                            expandedLayerData = VoxelRLE.Decompress(edit.BeforeVoxels);
                        }

                        expandedLayerData[byteIndex] = oldHeadVoxels[byteIndex];
                        expandedLayerData[byteIndex + 1] = oldHeadVoxels[byteIndex + 1];
                        wasChanged = true;
                    }
                    else
                    {
                        itemsToRemove.Add(byteIndex);
                    }
                }
                catch (ArgumentOutOfRangeException)
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
    }

    private static void AddDiffToFutureEdits(
        ReducerContext ctx,
        List<LayerHistoryEntry> edits,
        int startIndex,
        Dictionary<int, byte[]> diff,
        byte[] redoneEntryBeforeVoxels)
    {
        for (int i = startIndex; i < edits.Count; i++)
        {
            var edit = edits[i];
            if (edit.Author == ctx.Sender)
            {
                continue;
            }

            bool wasChanged = false;
            byte[] expandedLayerData = null;

            foreach (var kvp in diff)
            {
                var byteIndex = kvp.Key;
                var voxelData = kvp.Value;
                var voxelIndex = byteIndex / 2;

                try
                {
                    var currentVoxel = VoxelRLE.GetVoxelAt(edit.BeforeVoxels, voxelIndex);

                    if (currentVoxel[0] == redoneEntryBeforeVoxels[byteIndex] &&
                        currentVoxel[1] == redoneEntryBeforeVoxels[byteIndex + 1])
                    {
                        if (expandedLayerData == null)
                        {
                            expandedLayerData = VoxelRLE.Decompress(edit.BeforeVoxels);
                        }

                        expandedLayerData[byteIndex] = voxelData[0];
                        expandedLayerData[byteIndex + 1] = voxelData[1];
                        wasChanged = true;
                    }
                }
                catch (ArgumentOutOfRangeException)
                {
                }
            }

            if (wasChanged)
            {
                edit.BeforeVoxels = VoxelRLE.Compress(expandedLayerData);
                ctx.Db.layer_history_entry.Id.Update(edit);
            }
        }
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
        ArgumentNullException.ThrowIfNull(voxelData);

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