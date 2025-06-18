import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useAuth } from "@/firebase/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  PlusCircle,
  FolderOpen,
  Calendar,
  User,
  LogOut,
} from "lucide-react";
import { FloatingVoxelsBackground } from "@/components/custom/FloatingVoxelsBackground";
import { createProject } from "@/lib/createProject";
import { Timestamp } from "@clockworklabs/spacetimedb-sdk";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Project } from "@/module_bindings";

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

export function ProjectsPage() {
  const navigate = useNavigate();
  const { connection } = useDatabase();
  const { userProjects } = useProjects();
  const { currentUser, signInWithGoogle, signOut } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

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

  const handleCreateNew = () => {
    if (!connection?.isActive) return;
    createProject(connection, navigate);
  };

  const filteredProjects = userProjects.filter((project) =>
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

  const SignInPrompt = () => (
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

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center text-center p-12">
      <FolderOpen className="w-20 h-20 text-muted-foreground mb-6" />
      <h2 className="text-2xl font-semibold mb-4 text-foreground">
        No projects found
      </h2>
      <p className="mb-8 text-muted-foreground max-w-md">
        You don't have any projects yet. Create your first voxel project to get
        started!
      </p>
      <Button onClick={handleCreateNew} className="flex items-center gap-2">
        <PlusCircle className="w-4 h-4" />
        Create Your First Project
      </Button>
    </div>
  );

  if (!currentUser || currentUser.isAnonymous) {
    return (
      <>
        <FloatingVoxelsBackground />
        <div className="relative z-0 min-h-screen">
          <header className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border">
            <div className="container mx-auto px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold">🌙 LunaVoxel</h1>
              </div>
              <Button onClick={handleSignIn} variant="outline" size="sm">
                Sign In
              </Button>
            </div>
          </header>
          <main className="container mx-auto px-6 py-12">
            <SignInPrompt />
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <FloatingVoxelsBackground />
      <div className="relative z-0 min-h-screen">
        <header className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border">
          <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">🌙 LunaVoxel</h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>

              <Button
                onClick={handleCreateNew}
                className="flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                Create New
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt="Profile"
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                    {currentUser.displayName?.split(" ")[0] || "User"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Your Projects</h2>
            <p className="text-muted-foreground">
              {filteredProjects.length === 0
                ? "No projects found"
                : `${filteredProjects.length} project${
                    filteredProjects.length === 1 ? "" : "s"
                  }`}
            </p>
          </div>

          {filteredProjects.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-8">
              {groupOrder.map((groupName) => {
                const projectsInGroup = groupedProjects[groupName];
                if (!projectsInGroup || projectsInGroup.length === 0)
                  return null;

                return (
                  <div key={groupName} className="space-y-4">
                    <h3 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {groupName}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {projectsInGroup.map((project) => (
                        <div
                          key={project.id}
                          onClick={() => visitProject(project.id)}
                          className="group cursor-pointer bg-card border border-border rounded-lg p-4 hover:border-primary/50 hover:bg-accent/50 transition-all duration-200"
                        >
                          <div className="aspect-video bg-muted rounded-md mb-3 flex items-center justify-center overflow-hidden">
                            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-4xl">
                              🌒
                            </div>
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                              {project.name}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {(project.lastVisited as Timestamp)
                                .toDate()
                                .toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
