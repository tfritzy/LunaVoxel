using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void MagicSelect(ReducerContext ctx, string projectId, int layerIndex, Vector3 position)
    {
        Log.Warn("MagicSelect reducer is deprecated and not implemented for chunk-based storage");
        // TODO: Implement MagicSelect for chunk-based storage
        // Requires loading all chunks upfront and performing BFS efficiently
    }
}