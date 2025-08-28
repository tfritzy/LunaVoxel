using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void ModifyBlock(ReducerContext ctx, string projectId, uint[] diffData, int layerIndex)
    {
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
            ?? throw new ArgumentException("No layer for this project");

        if (layer.Locked) return;

        uint[] voxels = VoxelCompression.Decompress(layer.Voxels);
        for (int i = 0; i < diffData.Length; i++)
        {
            if (diffData[i] != 0)
            {
                voxels[i] = diffData[i];
            }
        }

        layer.Voxels = VoxelCompression.Compress(voxels);
        ctx.Db.layer.Id.Update(layer);

        var project = ctx.Db.projects.Id.Find(projectId) ?? throw new ArgumentException("No such project");
        if (ctx.Sender == project.Owner)
        {
            // Updated is used to find the most recent project of the user, so don't care about shared updates.
            project.Updated = ctx.Timestamp;
            ctx.Db.projects.Id.Update(project);
        }
    }
}