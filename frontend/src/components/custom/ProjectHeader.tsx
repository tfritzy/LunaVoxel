import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { FileDropdown } from "./FileDropdown";
import { UserDropdown } from "./Share/UserDropdown";
import { useAuth } from "@/firebase/AuthContext";
import { useNavigate } from "react-router-dom";
import { createProject } from "@/lib/createProject";
import { ProjectNameInput } from "./ProjectNameInput";
import { Logo } from "./Logo";
import { ProjectModal } from "./ProjectModal";
import { ShareButton } from "./Share/ShareButton";
import { useDatabase } from "@/contexts/DatabaseContext";

export function ProjectHeader() {
  const { currentUser, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const [isProjectListOpen, setIsProjectListOpen] = useState(false);
  const { projectId } = useParams();
  const { connection } = useDatabase();

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

  const handleNewProject = async () => {
    try {
      await createProject(connection, navigate);
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  const handleOpenProject = () => {
    setIsProjectListOpen(true);
  };

  const handleCloseProject = () => {
    setIsProjectListOpen(false);
  };

  const visitProject = (projectId: string) => {
    try {
      navigate(`/project/${projectId}`);
    } catch (err) {
      console.error("Error selecting project:", err);
    }
  };

  return (
    <>
      <nav className="h-16 w-full bg-background border-b border-border relative z-10">
        <div className="w-full h-full py-2 flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
            <Link
              to="/projects"
              className="text-xl font-bold text-foreground hover:text-primary transition-colors"
            >
              <Logo />
            </Link>
            <div className="flex items-center space-x-1">
              <FileDropdown
                onNew={handleNewProject}
                onOpen={handleOpenProject}
              />
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            {projectId && <ProjectNameInput />}
          </div>

          <div className="flex items-center space-x-2">
            {projectId && <ShareButton />}
            <UserDropdown
              user={currentUser}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </nav>

      {isProjectListOpen && (
        <ProjectModal
          isOpen={isProjectListOpen}
          onClose={handleCloseProject}
          onProjectClick={visitProject}
        />
      )}
    </>
  );
}
