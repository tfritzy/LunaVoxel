import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { useAuth } from "@/firebase/AuthContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { createProject } from "@/lib/createProject";
import { Project } from "@/module_bindings";
import { Timestamp } from "@clockworklabs/spacetimedb-sdk";
import {
  Search,
  Plus,
  FolderOpen,
  Clock,
  Users,
  ArrowRight,
  Sparkles,
  Grid3X3,
  List,
} from "lucide-react";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = "all" | "recent" | "shared";
type LayoutMode = "grid" | "list";

const getRelativeTime = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const getProjectPreview = (project: Project): string => {
  // Generate a simple preview based on project name initials
  return project.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export function ProjectModal({ isOpen, onClose }: ProjectModalProps) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { userProjects, sharedProjects } = useProjects();
  const { connection } = useDatabase();

  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");
  const [isCreating, setIsCreating] = useState(false);

  // Combine and filter projects
  const allProjects = [...userProjects, ...sharedProjects];
  const recentProjects = allProjects
    .sort((a, b) => b.updated.toDate().getTime() - a.updated.toDate().getTime())
    .slice(0, 6);

  const getFilteredProjects = (): Project[] => {
    let projects: Project[] = [];

    switch (viewMode) {
      case "recent":
        projects = recentProjects;
        break;
      case "shared":
        projects = sharedProjects;
        break;
      default:
        projects = allProjects;
    }

    if (searchTerm.trim()) {
      projects = projects.filter((project) =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return projects.sort(
      (a, b) => b.updated.toDate().getTime() - a.updated.toDate().getTime()
    );
  };

  const filteredProjects = getFilteredProjects();

  const handleProjectClick = (projectId: string) => {
    navigate(`/project/${projectId}`);
    onClose();
  };

  const handleCreateProject = async () => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      await createProject(connection, navigate);
      onClose();
    } catch (error) {
      console.error("Error creating project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  // Reset search when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  const ProjectCard = ({
    project,
    isShared,
  }: {
    project: Project;
    isShared: boolean;
  }) => {
    const preview = getProjectPreview(project);

    return (
      <div
        onClick={() => handleProjectClick(project.id)}
        className="group relative bg-card border border-border rounded-xl p-6 hover:border-primary/30 hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden"
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center text-sm font-semibold text-primary border border-primary/20">
                {preview}
              </div>
              {isShared && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  Shared
                </Badge>
              )}
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
          </div>

          <h3 className="font-semibold text-foreground mb-2 truncate group-hover:text-primary transition-colors">
            {project.name}
          </h3>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{getRelativeTime(project.updated)}</span>
          </div>
        </div>
      </div>
    );
  };

  const ProjectListItem = ({
    project,
    isShared,
  }: {
    project: Project;
    isShared: boolean;
  }) => {
    const preview = getProjectPreview(project);

    return (
      <div
        onClick={() => handleProjectClick(project.id)}
        className="group flex items-center gap-4 p-4 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors border border-transparent hover:border-border"
      >
        <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center text-sm font-medium text-primary border border-primary/20">
          {preview}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            {isShared && (
              <Badge variant="secondary" className="text-xs">
                <Users className="w-3 h-3 mr-1" />
                Shared
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{getRelativeTime(project.updated)}</span>
          </div>
        </div>

        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
        <FolderOpen className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {searchTerm
          ? "No projects found"
          : viewMode === "shared"
            ? "No shared projects"
            : viewMode === "recent"
              ? "No recent projects"
              : "No projects yet"}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        {searchTerm
          ? `No projects match "${searchTerm}". Try a different search term.`
          : viewMode === "shared"
            ? "No one has shared any projects with you yet."
            : "Create your first project to get started with LunaVoxel."}
      </p>
      {!searchTerm && viewMode !== "shared" && (
        <Button onClick={handleCreateProject} disabled={isCreating}>
          <Plus className="w-4 h-4 mr-2" />
          {isCreating ? "Creating..." : "Create New Project"}
        </Button>
      )}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Open project" size="5xl">
      <div className="min-h-[70vh] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-border pb-6">
          {/* Search and filters */}
          <div className="flex items-center gap-4 w-full justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-muted rounded-lg p-1">
                  {(["all", "recent", "shared"] as ViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === mode
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      {mode === "all"
                        ? "All"
                        : mode === "recent"
                          ? "Recent"
                          : "Shared"}
                    </button>
                  ))}
                </div>

                <div className="flex bg-muted rounded-lg p-1">
                  <button
                    onClick={() => setLayoutMode("grid")}
                    className={`p-2 rounded-md transition-colors ${layoutMode === "grid"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setLayoutMode("list")}
                    className={`p-2 rounded-md transition-colors ${layoutMode === "list"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <Button
              onClick={handleCreateProject}
              disabled={isCreating}
              className=""
            >
              <Plus className="w-4 h-4" />
              {isCreating ? "Creating..." : "New Project"}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 py-6">
          {filteredProjects.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="h-full overflow-y-auto">
              {layoutMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      isShared={sharedProjects.some((p) => p.id === project.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProjects.map((project) => (
                    <ProjectListItem
                      key={project.id}
                      project={project}
                      isShared={sharedProjects.some((p) => p.id === project.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer stats */}
        {filteredProjects.length > 0 && (
          <div className="border-t border-border pt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {filteredProjects.length} project
              {filteredProjects.length !== 1 ? "s" : ""}
            </span>
            <span>Press ↵ to open first project</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
