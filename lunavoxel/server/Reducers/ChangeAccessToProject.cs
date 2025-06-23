using System.Text.RegularExpressions;
using SpacetimeDB;
using SpacetimeDB.Internal.TableHandles;

public static partial class Module
{
    [Reducer]
    public static void ChangeUserAccessToProject(ReducerContext ctx, string projectId, string email, AccessType accessType)
    {
        if (string.IsNullOrEmpty(projectId))
        {
            throw new ArgumentException("Project ID cannot be null or empty.");
        }

        if (string.IsNullOrEmpty(email))
        {
            throw new ArgumentException("Email cannot be null or empty.");
        }

        var userAccess = ctx.Db.user_projects.idx_user_project.Filter((projectId, ctx.Sender)).FirstOrDefault();
        if (userAccess == null || userAccess.AccessType != AccessType.ReadWrite)
        {
            throw new ArgumentException("You do not have permission to edit user access in this project.");
        }

        var project = ctx.Db.projects.Id.Find(projectId) ?? throw new ArgumentException("Project not found");
        var userProject = ctx.Db.user_projects.idx_project_id_email.Filter((projectId, email)).FirstOrDefault();
        if (userProject == null)
        {
            throw new ArgumentException("User not found in this project.");
        }

        if (project.Owner == userProject.User)
        {
            throw new ArgumentException("You cannot change access for the project owner.");
        }

        if (accessType == AccessType.None)
        {
            ctx.Db.user_projects.Id.Delete(userProject.Id);
        }
        else
        {
            userProject.AccessType = accessType;
            ctx.Db.user_projects.Id.Update(userProject);
        }
    }
}