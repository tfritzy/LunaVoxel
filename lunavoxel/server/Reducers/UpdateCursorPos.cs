using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void UpdateCursorPos(ReducerContext ctx, string projectId, Identity identity, float x, float y, float z)
    {
        if (string.IsNullOrEmpty(projectId))
        {
            throw new ArgumentException("Project ID cannot be null or empty.");
        }

        var cursor = ctx.Db.player_cursor.player_cursor_project_player.Filter((projectId, identity)).FirstOrDefault();
        if (cursor == null)
        {
            cursor = new PlayerCursor
            {
                Id = IdGenerator.Generate("csr"),
                ProjectId = projectId,
                Player = identity,
                Position = new Vector3Float(x, y, z)
            };
            ctx.Db.player_cursor.Insert(cursor);
        }
        else
        {
            cursor.Position = new Vector3Float(x, y, z);
            ctx.Db.player_cursor.Id.Update(cursor);
        }
    }
}
