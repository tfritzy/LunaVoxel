using SpacetimeDB;
using System.Text.RegularExpressions;

public static partial class Module
{
    [Reducer]
    public static void InviteToProject(ReducerContext ctx, string projectId, string email, AccessType accessType)
    {
        if (string.IsNullOrEmpty(projectId))
        {
            throw new ArgumentException("Project ID cannot be null or empty.");
        }

        if (string.IsNullOrEmpty(email))
        {
            throw new ArgumentException("Email cannot be null or empty.");
        }

        if (!IsValidEmail(email))
        {
            throw new ArgumentException("Invalid email address.");
        }

        var userAccess = ctx.Db.user_projects.idx_user_project.Filter((projectId, ctx.Sender)).FirstOrDefault();
        if (userAccess == null || userAccess.AccessType != AccessType.ReadWrite)
        {
            throw new ArgumentException("You do not have permission to invite users to this project.");
        }

        var userProject = ctx.Db.user_projects.idx_project_id_email.Filter((projectId, email)).FirstOrDefault();
        if (userProject != null)
        {
            userProject.AccessType = accessType;
            ctx.Db.user_projects.Id.Update(userProject);
            return;
        }

        var user = ctx.Db.user.email.Filter(email).FirstOrDefault();
        userProject = UserProject.Build(user?.Identity ?? new Identity(), projectId, accessType, email);
        ctx.Db.user_projects.Insert(userProject);
    }

    private static bool IsValidEmail(string email)
    {
        var regex = new Regex(@"^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$");
        return regex.IsMatch(email);
    }
}
