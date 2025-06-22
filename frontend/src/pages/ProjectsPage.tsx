import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useAuth } from "@/firebase/AuthContext";
import { Button } from "@/components/ui/button";
import { FolderOpen, Users, Plus } from "lucide-react";
import { createProject } from "@/lib/createProject";
import { ProjectGrid } from "@/components/custom/ProjectsGrid";
import { Logo } from "@/components/custom/Logo";
import { UserDropdown } from "@/components/custom/ShareModal/UserDropdown";

export function ProjectsPage() {
  const navigate = useNavigate();
  const { connection } = useDatabase();
  const { currentUser, signInWithGoogle, signOut } = useAuth();
  const [viewMode, setViewMode] = useState<"my" | "shared">("my");

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/projects");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const visitProject = (projectId: string) => {
    if (!connection?.isActive) return;
    try {
      navigate(`/project/${projectId}`);
    } catch (err) {
      console.error("Error selecting project:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95">
      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="border-b border-border/50 bg-background/80 backdrop-blur-md shadow-sm">
          <div className="container mx-auto px-6">
            <div className="flex justify-between items-center h-16">
              <Logo />
              <div className="flex items-center gap-4">
                <UserDropdown
                  currentUser={currentUser}
                  onSignIn={handleSignIn}
                  onSignOut={handleSignOut}
                />
              </div>
            </div>
          </div>
        </header>

        <main className="flex h-[calc(100vh-4rem)] mx-auto container">
          <div className="w-64 border-r border-border/50 flex-shrink-0">
            <div className="px-6 pt-4 space-y-1">
              <Button
                onClick={() => {
                  if (!connection?.isActive) return;
                  const navigate_local = navigate;
                  createProject(connection, navigate_local);
                }}
                className="w-min font-semibold flex items-center gap-3 justify-start h-11 mb-5"
                size="lg"
                variant="outline"
              >
                <Plus className="w-8 h-8" />
                New project
              </Button>

              <div
                onClick={() => setViewMode("my")}
                className={`w-full flex items-center gap-3 justify-start h-10 px-3 rounded-md cursor-pointer transition-colors ${
                  viewMode === "my"
                    ? "text-foreground bg-accent/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/25"
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                My Projects
              </div>

              <div
                onClick={() => setViewMode("shared")}
                className={`w-full flex items-center gap-3 justify-start h-10 px-3 rounded-md cursor-pointer transition-colors ${
                  viewMode === "shared"
                    ? "text-foreground bg-accent/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/25"
                }`}
              >
                <Users className="w-4 h-4" />
                Shared with me
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <h1 className="text-2xl font-semibold ml-6 mt-4">My projects</h1>
            <ProjectGrid
              viewMode={viewMode}
              onProjectClick={visitProject}
              showCreateButton={false}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
