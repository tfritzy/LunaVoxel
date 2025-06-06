using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void
    InitializePalette(ReducerContext ctx, string worldId)
    {
        var existingPalette = ctx.Db.ColorPalette.World.Find(worldId);
        if (existingPalette != null)
        {
            return;
        }

        var defaultColors = new string[]{
            "#2e2e43", "#4a4b5b", "#707b89", "#a9bcbf", "#e6eeed", "#fcfbf3", "#fceba8", "#f5c47c",
            "#e39764", "#c06852", "#9d4343", "#813645", "#542240", "#2a152d", "#4f2d4d", "#5b3a56",
            "#794e6d", "#3e4c7e", "#495f94", "#5a78b2", "#7396d5", "#7fbbdc", "#aaeeea", "#d5f893",
            "#96dc7f", "#6ec077", "#4e9363", "#3c6c54", "#2c5049", "#34404f", "#405967", "#5c8995",
        };

        ctx.Db.ColorPalette.Insert(new ColorPalette { World = worldId, Colors = defaultColors });
        Log.Info($"Initialized color palette for world {worldId}");
    }
}
