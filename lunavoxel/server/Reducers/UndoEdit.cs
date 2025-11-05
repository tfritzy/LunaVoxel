using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void UndoEdit(
        ReducerContext ctx,
        string projectId,
        byte[] beforeDiff,
        byte[] afterDiff,
        int layerIndex)
    {
        Log.Warn("UndoEdit reducer is deprecated and not implemented for chunk-based storage");
        // TODO: Implement UndoEdit for chunk-based storage
    }
}