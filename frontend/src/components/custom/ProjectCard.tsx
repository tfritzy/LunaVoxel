import { Project } from "@/module_bindings";
import { formatDistanceToNow } from "date-fns";

interface ProjectCardProps {
  project: Project;
  onClick: (projectId: string) => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const lastVisitedRelative = formatDistanceToNow(project.updated.toDate(), {
    addSuffix: true,
  });

  return (
    <div
      className="border rounded p-4 cursor-pointer hover:bg-secondary/10 transition-colors"
      onClick={() => onClick(project.id)}
    >
      <h2 className="text-xl font-semibold">{project.name}</h2>
      <div className="mt-2 space-y-1">
        <p className="text-sm">
          <span className="text-muted-foreground">Size:</span>{" "}
          {project.dimensions.x}x{project.dimensions.y}x{project.dimensions.z}
        </p>
        <p className="text-sm text-muted-foreground">
          Last visited: {lastVisitedRelative}
        </p>
      </div>
    </div>
  );
}
