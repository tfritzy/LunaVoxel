import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { FileDropdown } from "./FileDropdown";
import { UserDropdown } from "./Share/UserDropdown";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useAuth } from "@/firebase/AuthContext";
import { useNavigate } from "react-router-dom";
import { createProject } from "@/lib/createProject";
import { ProjectNameInput } from "./ProjectNameInput";
import { Logo } from "./Logo";
import { ProjectModal } from "./ProjectModal";
import { ShareModal } from "./Share/ShareModal";

export function ProjectHeader() {
  const { currentUser, signInWithGoogle, signOut } = useAuth();
  const { connection } = useDatabase();
  const { userProjects, sharedProjects } = useProjects();
  const navigate = useNavigate();
  const [isProjectListOpen, setIsProjectListOpen] = useState(false);
  const { projectId } = useParams();
  const [shareModalOpen, setShareModalOpen] = useState(false);

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
            <UserDropdown
              currentUser={currentUser}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </nav>

      <ShareModal
        projectId={projectId!}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />

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
