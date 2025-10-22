using SpacetimeDB;
using System;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void AddLayer(
        ReducerContext ctx,
        string projectId)
    {
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var project = ctx.Db.projects.Id.Find(projectId) ?? throw new ArgumentException("Project not found");
        var existingLayers = ctx.Db.layer.layer_project.Filter(projectId).ToList();
        int nextIndex = existingLayers.Count > 0 ? existingLayers.Max(l => l.Index) + 1 : 0;

        if (nextIndex > 10)
        {
            throw new ArgumentException("Max of 10 layers reached");
        }

        AddLayerAndChunks(ctx, project, nextIndex);
    }

    public static void AddLayerAndChunks(ReducerContext ctx, Project project, int index)
    {
        var newLayer = Layer.Build(
            project.Id,
            project.Dimensions.X,
            project.Dimensions.Y,
            project.Dimensions.Z,
            index
        );
        ctx.Db.layer.Insert(newLayer);

        int chunksX = (int)Math.Ceiling((double)project.Dimensions.X / CHUNK_SIZE);
        int chunksZ = (int)Math.Ceiling((double)project.Dimensions.Z / CHUNK_SIZE);
        for (int x = 0; x < chunksX; x++)
        {
            for (int z = 0; z < chunksZ; z++)
            {
                int startX = x * CHUNK_SIZE;
                int startZ = z * CHUNK_SIZE;

                var chunk = Chunk.Build(
                    project.Id,
                    newLayer.Id,
                    startX,
                    startZ,
                    project.Dimensions.Y
                );
                ctx.Db.chunk.Insert(chunk);
            }
        }
    }
}