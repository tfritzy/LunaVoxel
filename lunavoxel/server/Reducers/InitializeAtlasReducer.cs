using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void InitializeAtlas(ReducerContext ctx, string projectId)
    {
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);
        var existingAtlas = ctx.Db.atlas.ProjectId.Find(projectId);
        if (existingAtlas != null)
        {
            return;
        }

        ProjectBlocks blocks = new() { ProjectId = projectId, BlockFaceAtlasIndexes = new int[64][] };
        for (int i = 0; i < blocks.BlockFaceAtlasIndexes.Length; i++)
        {
            blocks.BlockFaceAtlasIndexes[i] = [i, i, i, i, i, i];
        }

        ctx.Db.atlas.Insert(new Atlas { ProjectId = projectId, Size = 64, CellSize = 1 });
        ctx.Db.project_blocks.Insert(blocks);
    }
}