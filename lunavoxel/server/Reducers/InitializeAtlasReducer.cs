using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void InitializeAtlas(ReducerContext ctx, string projectId)
    {
        var existingAtlas = ctx.Db.atlas.ProjectId.Find(projectId);
        if (existingAtlas != null)
        {
            return;
        }

        var defaultColors = new int[]{
            0x2e2e43, 0x4a4b5b, 0x707b89, 0xa9bcbf, 0xe6eeed, 0xfcfbf3, 0xfceba8, 0xf5c47c,
            0xe39764, 0xc06852, 0x9d4343, 0x813645, 0x542240, 0x2a152d, 0x4f2d4d, 0x5b3a56,
            0x794e6d, 0x3e4c7e, 0x495f94, 0x5a78b2, 0x7396d5, 0x7fbbdc, 0xaaeeea, 0xd5f893,
            0x96dc7f, 0x6ec077, 0x4e9363, 0x3c6c54, 0x2c5049, 0x34404f, 0x405967, 0x5c8995,
        };

        ctx.Db.atlas.Insert(new Atlas { ProjectId = projectId, Colors = defaultColors });
    }
}
