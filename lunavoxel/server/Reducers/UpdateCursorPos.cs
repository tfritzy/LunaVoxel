using System.Security.Cryptography;
using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void UpdateCursorPos(ReducerContext ctx, string projectId, Identity identity, Vector3Float? pos, Vector3Float? normal)
    {
        if (string.IsNullOrEmpty(projectId))
        {
            throw new ArgumentException("Project ID cannot be null or empty.");
        }

        var cursor = ctx.Db.player_cursor.player_cursor_project_player.Filter((projectId, identity)).FirstOrDefault();
        if (cursor == null)
        {
            var player = ctx.Db.user.Identity.Find(identity);
            var displayName = string.IsNullOrEmpty(player?.Email) ? RandomNameGenerator.GenerateName() : player.Email;
            cursor = new PlayerCursor
            {
                Id = IdGenerator.Generate("csr"),
                ProjectId = projectId,
                Player = identity,
                DisplayName = displayName,
                Position = pos,
                Normal = normal,
                LastUpdated = ctx.Timestamp
            };
            ctx.Db.player_cursor.Insert(cursor);
        }
        else
        {
            cursor.Position = pos;
            cursor.Normal = normal;
            cursor.LastUpdated = ctx.Timestamp;

            if (string.IsNullOrEmpty(cursor.DisplayName))
            {
                var player = ctx.Db.user.Identity.Find(identity);
                cursor.DisplayName = string.IsNullOrEmpty(player?.Email) ? RandomNameGenerator.GenerateName() : player.Email;
            }

            ctx.Db.player_cursor.Id.Update(cursor);
        }
    }
}