import { useParams } from "react-router-dom";
import { FileDropdown } from "./FileDropdown";
import { EditDropdown } from "./EditDropdown";
import { useNavigate } from "react-router-dom";
import { createProject } from "@/lib/createProject";
import { ProjectNameInput } from "./ProjectNameInput";
import { Logo } from "./Logo";
import { useState, useCallback } from "react";
import { PresenceIndicator } from "./PresenceIndicator";
import { ShareButton } from "./Share/ShareButton";
import { ExportType } from "@/modeling/export/model-exporter";
import type { AccessType } from "@/state";
import { ProjectModal } from "./ProjectModal";

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
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [openProjectOpen, setOpenProjectOpen] = useState(false);

  const handleNewProject = useCallback(async () => {
    try {
      await createProject(navigate);
    } catch (error) {
      console.error("Error creating project:", error);
    }
  }, [navigate]);

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
          </div>
          <ProjectModal
            isOpen={openProjectOpen}
            onClose={handleCloseProjectModal}
          />
        </div>
      </nav>

    </>
  );
}