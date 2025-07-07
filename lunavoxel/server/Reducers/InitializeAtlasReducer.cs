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

        var blocks = new Block[64];
        for (int i = 0; i < blocks.Length; i++)
        {
            blocks[i] = new Block
            {
                Faces =
                [
                    new Face { AtlasIndex = i },
                    new Face { AtlasIndex = i },
                    new Face { AtlasIndex = i },
                    new Face { AtlasIndex = i },
                    new Face { AtlasIndex = i },
                    new Face { AtlasIndex = i }
                ]
            };

        }
        ctx.Db.atlas.Insert(new Atlas { ProjectId = projectId, Size = 64, Blocks = blocks, CellSize = 1 });
    }
}