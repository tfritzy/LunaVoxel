using System;
using System.Linq;
using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void UpdateProjectName(ReducerContext ctx, string projectId, string name)
    {
        if (string.IsNullOrWhiteSpace(projectId))
            throw new ArgumentException("Project ID cannot be null or empty");
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Project name cannot be null or empty");

        name = name.Trim();

        if (name.Length > 100)
            throw new ArgumentException("Project name cannot exceed 100 characters");
        if (name.Length < 1)
            throw new ArgumentException("Project name must be at least 1 character long");

        var project = ctx.Db.projects.Id.Find(projectId)
            ?? throw new Exception($"Project with ID {projectId} not found");

        if (project.Owner != ctx.Sender)
            throw new UnauthorizedAccessException("Only the project owner can update the project name");

        project.Name = name;
        ctx.Db.projects.Id.Update(project);
    }
}