import { Link, useParams } from "react-router-dom";
import { FileDropdown } from "./FileDropdown";
import { EditDropdown } from "./EditDropdown";
import { useAuth } from "@/firebase/AuthContext";
import { useNavigate } from "react-router-dom";
import { createProject } from "@/lib/createProject";
import { ProjectNameInput } from "./ProjectNameInput";
import { Logo } from "./Logo";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useState, useCallback } from "react";
import { PresenceIndicator } from "./PresenceIndicator";
import { ShareButton } from "./Share/ShareButton";
import { UserDropdown } from "./Share/UserDropdown";
import { ExportType } from "@/modeling/export/model-exporter";
import { AccessType } from "@/module_bindings";

interface ProjectHeaderProps {
  onExport: (format: ExportType) => void;
  onUndo: () => void;
  onRedo: () => void;
  accessLevel: AccessType | null;
}

export function ProjectHeader({
  onExport,
  onUndo,
  onRedo,
  accessLevel,
}: ProjectHeaderProps) {
  const { currentUser, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { connection } = useDatabase();
  const [openProjectOpen, setOpenProjectOpen] = useState(false);

  const handleSignIn = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  }, [signInWithGoogle]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      navigate("/projects");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, [signOut, navigate]);

  const handleNewProject = useCallback(async () => {
    try {
      await createProject(connection, navigate);
    } catch (error) {
      console.error("Error creating project:", error);
    }
  }, [connection, navigate]);

  const handleOpenProject = useCallback(() => {
    setOpenProjectOpen(true);
  }, []);

  const handleCloseProjectModal = useCallback(() => {
    setOpenProjectOpen(false);
  }, []);

  return (
    <>
      <nav className="h-18 w-full bg-background border-b border-border relative z-10">
        <div className="w-full h-full py-2 flex justify-between items-center px-4">
          <div className="flex items-center gap-4 pl-2">
            <Logo />
            <div className="-translate-x-2">
              <div className="">
                <ProjectNameInput />
              </div>
              <div className="flex items-center">
                <FileDropdown
                  onNewProject={handleNewProject}
                  onOpenProject={handleOpenProject}
                  onExport={onExport}
                />
                {onUndo && onRedo && (
                  <EditDropdown onUndo={onUndo} onRedo={onRedo} />
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {projectId && <PresenceIndicator />}
            {projectId && <ShareButton accessLevel={accessLevel} />}
            <UserDropdown
              currentUser={currentUser}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
            />
          </div>
          {/* <ProjectModal
            isOpen={openProjectOpen}
            onClose={handleCloseProjectModal}
          /> */}
        </div>
      </nav>
    </>
  );
}
