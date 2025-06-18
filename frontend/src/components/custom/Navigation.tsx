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
import { ProjectList } from "./ProjectList";
import { ProjectNameInput } from "./ProjectNameInput";
import { Logo } from "./Logo";

export function Navigation() {
  const { currentUser, signInWithGoogle, signOut } = useAuth();
  const { connection } = useDatabase();
  const { userProjects } = useProjects();
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
                variant="default"
                size="sm"
                onClick={handleSignIn}
                className="flex items-center gap-2"
              >
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
            ) : currentUser && !currentUser.isAnonymous ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 py-2"
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
            ) : null}
          </div>
        </div>
      </nav>

      <ProjectList
        isOpen={isProjectListOpen}
        onClose={handleCloseProject}
        projects={userProjects}
        onProjectClick={visitProject}
      />
    </>
  );
}
