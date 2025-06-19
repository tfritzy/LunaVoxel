import { Link } from "react-router-dom";
import { User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/firebase/AuthContext";
import { useState } from "react";
import { FileDropdown } from "./FileDropdown";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useNavigate } from "react-router-dom";
import { createProject } from "@/lib/createProject";
import { ProjectNameInput } from "./ProjectNameInput";
import { Logo } from "./Logo";
import { ProjectModal } from "./ProjectModal";

export function Navigation() {
  const { currentUser, signInWithGoogle, signOut } = useAuth();
  const { connection } = useDatabase();
  const { userProjects, sharedProjects } = useProjects();
  const navigate = useNavigate();
  const [isProjectListOpen, setIsProjectListOpen] = useState(false);

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

  const handleNewProject = () => {
    if (!connection?.isActive) return;
    createProject(connection, navigate);
  };

  const handleOpenProject = () => {
    setIsProjectListOpen(true);
  };

  const handleCloseProject = () => {
    setIsProjectListOpen(false);
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
    <>
      <nav className="h-16 w-full backdrop-brightness-75 backdrop-blur border-b border-border relative z-10">
        <div className="w-full h-full py-2 flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
            <Link
              to="/projects"
              className="flex items-center gap-2 font-semibold text-4xl"
            >
              <Logo />
            </Link>

            <div>
              <div className="flex flex-row">
                <ProjectNameInput />
              </div>
              <div className="flex flex-row">
                <FileDropdown
                  onNewProject={handleNewProject}
                  onOpenProject={handleOpenProject}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center">
            {currentUser?.isAnonymous ? (
              <Button
                onClick={handleSignIn}
                variant="ghost"
                className="flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                Sign In
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 hover:bg-accent/50"
                  >
                    {currentUser?.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt="Profile"
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">
                      {currentUser?.displayName || "User"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-destructive focus:text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </nav>

      <ProjectModal
        isOpen={isProjectListOpen}
        onClose={handleCloseProject}
        userProjects={userProjects}
        sharedProjects={sharedProjects}
        onProjectClick={visitProject}
      />
    </>
  );
}
