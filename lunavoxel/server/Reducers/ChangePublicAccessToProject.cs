using System.Text.RegularExpressions;
using SpacetimeDB;
using SpacetimeDB.Internal.TableHandles;

public static partial class Module
{
    [Reducer]
    public static void ChangePublicAccessToProject(ReducerContext ctx, string projectId, AccessType accessType)
    {
        if (string.IsNullOrEmpty(projectId))
        {
            throw new System.ArgumentException("Project ID cannot be null or empty.");
        }

        var userAccess = ctx.Db.user_projects.idx_user_project.Filter((projectId, ctx.Sender)).FirstOrDefault();
        if (userAccess == null || userAccess.AccessType != AccessType.ReadWrite)
        {
            throw new System.ArgumentException("You do not have permission to edit user access in this project.");
        }

        var project = ctx.Db.projects.Id.Find(projectId) ?? throw new System.ArgumentException("Project not found");
        project.PublicAccess = accessType;
        ctx.Db.projects.Id.Update(project);
    }
}
