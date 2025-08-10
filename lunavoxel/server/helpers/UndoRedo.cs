using SpacetimeDB;
using static Module;

public static class UndoRedo
{
    public static void AddEntry(
        ReducerContext ctx,
        string projectId,
        string layerId,
        short[] beforeVoxels,
        short[] afterVoxels)
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

        short[] newLayerVoxels;
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
        Dictionary<int, short> diff,
        short[] oldHeadVoxels)
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
            short[] expandedLayerData = null;

            foreach (var kvp in diff)
            {
                var voxelIndex = kvp.Key;
                var voxelData = kvp.Value;

                try
                {
                    var currentVoxel = VoxelRLE.GetVoxelAt(edit.BeforeVoxels, voxelIndex);

                    if (currentVoxel == voxelData)
                    {
                        if (expandedLayerData == null)
                        {
                            expandedLayerData = VoxelRLE.Decompress(edit.BeforeVoxels);
                        }

                        expandedLayerData[voxelIndex] = oldHeadVoxels[voxelIndex];
                        wasChanged = true;
                    }
                    else
                    {
                        itemsToRemove.Add(voxelIndex);
                    }
                }
                catch (ArgumentOutOfRangeException)
                {
                    itemsToRemove.Add(voxelIndex);
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
        Dictionary<int, short> diff,
        short[] redoneEntryBeforeVoxels)
    {
        for (int i = startIndex; i < edits.Count; i++)
        {
            var edit = edits[i];
            if (edit.Author == ctx.Sender)
            {
                continue;
            }

            bool wasChanged = false;
            short[] expandedLayerData = null;

            foreach (var kvp in diff)
            {
                var voxelIndex = kvp.Key;
                var voxelData = kvp.Value;

                try
                {
                    var currentVoxel = VoxelRLE.GetVoxelAt(edit.BeforeVoxels, voxelIndex);

                    if (currentVoxel == redoneEntryBeforeVoxels[voxelIndex])
                    {
                        if (expandedLayerData == null)
                        {
                            expandedLayerData = VoxelRLE.Decompress(edit.BeforeVoxels);
                        }

                        expandedLayerData[voxelIndex] = voxelData;
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

    public static short[] XorExpandedLayers(short[] layer1, short[] layer2)
    {
        if (layer1 == null || layer2 == null)
            throw new ArgumentNullException();

        if (layer1.Length != layer2.Length)
            throw new ArgumentException("Layers must have the same length");

        var result = new short[layer1.Length];

        for (int i = 0; i < layer1.Length; i++)
        {
            short xor = (short)(layer1[i] ^ layer2[i]);

            if (xor != 0)
            {
                result[i] = layer2[i];
            }
        }

        return result;
    }

    public static Dictionary<int, short> VoxelDataToDictionary(short[] voxelData)
    {
        ArgumentNullException.ThrowIfNull(voxelData);

        var result = new Dictionary<int, short>();

        for (int i = 0; i < voxelData.Length; i++)
        {
            if (voxelData[i] != 0)
            {
                result[i] = voxelData[i];
            }
        }

        return result;
    }

    public static short[] ApplyDiff(short[] beforeVoxels, short[] diff)
    {
        if (beforeVoxels == null || diff == null)
            throw new ArgumentNullException();

        if (beforeVoxels.Length != diff.Length)
            throw new ArgumentException("Before voxels and diff must have the same length");

        var result = new short[beforeVoxels.Length];
        Array.Copy(beforeVoxels, result, beforeVoxels.Length);

        for (int i = 0; i < diff.Length; i++)
        {
            if (diff[i] != 0)
            {
                result[i] = diff[i];
            }
        }

        return result;
    }
}