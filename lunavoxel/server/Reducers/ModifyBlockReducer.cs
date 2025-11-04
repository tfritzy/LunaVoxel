using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.Linq;

public static partial class Module
{
    // DEPRECATED: This reducer is deprecated in favor of ModifyBlockRect
    // It remains for backwards compatibility but should not be used
    [Reducer]
    public static void ModifyBlock(ReducerContext ctx, string projectId, BlockModificationMode mode, byte[] diffData, int layerIndex)
    {
        // Redirect to ModifyBlockRect which handles all cases efficiently
        // This is a no-op now - clients should use ModifyBlockRect instead
        Log.Warning("ModifyBlock reducer is deprecated. Use ModifyBlockRect instead.");
    }
}