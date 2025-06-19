import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Timestamp } from "@clockworklabs/spacetimedb-sdk";
import React from "react";
import { FolderOpen, PlusCircle, Search, User } from "lucide-react";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useNavigate } from "react-router-dom";
import { createProject } from "@/lib/createProject";
import { useAuth } from "@/firebase/AuthContext";
import { Project } from "@/module_bindings";

interface ProjectGridProps {
  projects: Project[];
  onProjectClick: (projectId: string) => void;
  onCreateProject?: () => void;
  showCreateButton?: boolean;
  showSearch?: boolean;
}

const getGroupLabel = (lastVisitedTimestamp: Timestamp): string => {
  const lastVisitedDate = lastVisitedTimestamp.toDate();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (lastVisitedDate >= todayStart) return "Today";

  const oneWeekAgoStart = new Date(todayStart);
  oneWeekAgoStart.setDate(todayStart.getDate() - 7);
  if (lastVisitedDate >= oneWeekAgoStart) return "Last week";

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (lastVisitedDate >= startOfMonth) return "Earlier this month";

  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(startOfMonth);
  endOfLastMonth.setDate(startOfMonth.getDate() - 1);
  if (lastVisitedDate >= startOfLastMonth && lastVisitedDate <= endOfLastMonth)
    return "Last month";

  return "Older";
};

const groupOrder = [
  "Today",
  "Last week",
  "Earlier this month",
  "Last month",
  "Older",
];

const SignInPrompt: React.FC = () => {
  const { signInWithGoogle } = useAuth();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-12">
      <FolderOpen className="w-20 h-20 text-muted-foreground mb-6" />
      <h2 className="text-2xl font-semibold mb-4 text-foreground">
        Sign in to view your projects
      </h2>
      <p className="mb-8 text-muted-foreground max-w-md">
        Sign in with Google to access your saved projects and create new ones.
      </p>
      <Button onClick={handleSignIn} className="flex items-center gap-2">
        <svg
          className="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
        >
          <path
            fill="#FFC107"
            d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
          />
          <path
            fill="#FF3D00"
            d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
          />
          <path
            fill="#4CAF50"
            d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
          />
          <path
            fill="#1976D2"
            d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
          />
        </svg>
        Sign In with Google
      </Button>
    </div>
  );
};

const EmptyState: React.FC<{ onCreateProject?: () => void }> = ({
  onCreateProject,
}) => (
  <div className="flex flex-col items-center justify-center text-center p-12">
    <FolderOpen className="w-20 h-20 text-muted-foreground mb-6" />
    <h2 className="text-2xl font-semibold mb-4 text-foreground">
      No projects found
    </h2>
    <p className="mb-8 text-muted-foreground max-w-md">
      You don't have any projects yet. Create one to get started!
    </p>
    {onCreateProject && (
      <Button onClick={onCreateProject} className="flex items-center gap-2">
        <PlusCircle className="w-4 h-4" />
        Create New Project
      </Button>
    )}
  </div>
);

export function ProjectGrid({
  projects,
  onProjectClick,
  onCreateProject,
  showCreateButton = true,
  showSearch = true,
}: ProjectGridProps) {
  const { connection } = useDatabase();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const handleCreateNew = () => {
    if (!connection?.isActive) return;
    createProject(connection, navigate);
    onCreateProject?.();
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedProjects = filteredProjects.reduce((groups, project) => {
    const group = getGroupLabel(project.lastVisited as Timestamp);
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(project);
    return groups;
  }, {} as Record<string, Project[]>);

  Object.keys(groupedProjects).forEach((groupName) => {
    groupedProjects[groupName].sort(
      (a, b) =>
        (b.lastVisited as Timestamp).toDate().getTime() -
        (a.lastVisited as Timestamp).toDate().getTime()
    );
  });

  if (currentUser?.isAnonymous) {
    return <SignInPrompt />;
  }

  return (
    <div className="flex flex-col h-full">
      {(showSearch || showCreateButton) && (
        <div className="flex flex-row items-center justify-between px-6 py-4 border-b border-border">
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 max-w-xs h-9"
              />
            </div>
          )}
          {showCreateButton && (
            <Button
              onClick={handleCreateNew}
              className="flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Create New Project
            </Button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filteredProjects.length === 0 ? (
          <EmptyState
            onCreateProject={showCreateButton ? handleCreateNew : undefined}
          />
        ) : (
          <div className="p-6">
            {groupOrder.map((groupName) => {
              const groupProjects = groupedProjects[groupName];
              if (!groupProjects || groupProjects.length === 0) return null;

              return (
                <div key={groupName} className="mb-8">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
                    {groupName}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {groupProjects.map((project) => (
                      <div
                        key={project.id}
                        onClick={() => onProjectClick(project.id)}
                        className="cursor-pointer group relative bg-card hover:bg-accent border border-border rounded-lg p-4 transition-all duration-200 hover:shadow-md hover:border-accent-foreground/20"
                      >
                        <div className="aspect-video bg-muted rounded-md mb-3 flex items-center justify-center overflow-hidden">
                          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <Search className="w-8 h-8 text-muted-foreground group-hover:text-foreground transition-colors" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm truncate group-hover:text-foreground transition-colors">
                            {project.name}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <User className="w-3 h-3" />
                            <span>
                              {(project.lastVisited as Timestamp)
                                .toDate()
                                .toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
