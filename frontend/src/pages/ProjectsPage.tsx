import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useAuth } from "@/firebase/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, LogOut, FolderOpen, Users, Search, Plus } from "lucide-react";
import { createProject } from "@/lib/createProject";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectGrid } from "@/components/custom/ProjectsGrid";
import { Logo } from "@/components/custom/Logo";

export function ProjectsPage() {
  const navigate = useNavigate();
  const { connection } = useDatabase();
  const { userProjects } = useProjects();
  const { currentUser, signOut } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

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

  const filteredProjects = userProjects.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95">
      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="border-b border-border/50 bg-background/80 backdrop-blur-md shadow-sm">
          <div className="container mx-auto px-6">
            <div className="flex justify-between items-center h-16">
              <Logo />
              <div className="flex items-center gap-4">
                {currentUser && !currentUser.isAnonymous && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex items-center gap-2 hover:bg-accent/50"
                      >
                        {currentUser.photoURL ? (
                          <img
                            src={currentUser.photoURL}
                            alt="Profile"
                            className="w-6 h-6 rounded-full ring-2 ring-border"
                          />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                        {currentUser.displayName?.split(" ")[0] || "User"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem>
                        <User className="w-4 h-4 mr-2" />
                        Profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex h-[calc(100vh-4rem)] mx-auto container">
          <div className="w-64 border-r border-border/50 flex-shrink-0">
            <div className="px-6 pt-8 space-y-1">
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

              <Button
                variant="ghost"
                className="w-full flex items-center gap-3 justify-start h-10 text-foreground bg-accent/50"
              >
                <FolderOpen className="w-4 h-4" />
                My Projects
              </Button>

              <Button
                variant="ghost"
                className="w-full flex items-center gap-3 justify-start h-10 text-muted-foreground hover:text-foreground"
              >
                <Users className="w-4 h-4" />
                Shared with me
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 min-h-0">
              <div className="flex flex-row items-center justify-between">
                <h1 className="text-4xl font-bold ml-6 mb-2 mt-6">
                  My Projects
                </h1>
              </div>
              <div className="h-full rounded-xl overflow-hidden pt-6">
                <div className="relative w-full max-w-md ml-6">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 h-12 text-base bg-background/80 border-border/50 focus:border-primary/50 focus:ring-primary/20"
                  />
                </div>

                <ProjectGrid
                  projects={filteredProjects}
                  onProjectClick={visitProject}
                  showCreateButton={false}
                  showSearch={false}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
