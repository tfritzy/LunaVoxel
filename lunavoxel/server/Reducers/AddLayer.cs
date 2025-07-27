using SpacetimeDB;
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

        var newLayer = Layer.Build(
            projectId,
            project.Dimensions.X,
            project.Dimensions.Y,
            project.Dimensions.Z,
            nextIndex
        );

        LayerHelpers.Add(ctx, newLayer);
    }
}