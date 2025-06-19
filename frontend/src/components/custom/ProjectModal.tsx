import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Modal } from "../ui/modal";
import { Project } from "@/module_bindings";
import { ProjectGrid } from "./ProjectsGrid";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onProjectClick: (projectId: string) => void;
}

export function ProjectModal({
  isOpen,
  onClose,
  projects,
  onProjectClick,
}: ProjectModalProps) {
  const handleProjectClick = (projectId: string) => {
    onProjectClick(projectId);
    onClose();
  };

  const handleCreateProject = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="sm:max-w-[1200px] min-h-[80vh] max-h-[90vh] w-[70vw] flex flex-col p-0">
        <div className="px-6 pt-4 pb-2 flex-shrink-0 border-b border-border">
          <div className="flex flex-row justify-between items-center">
            <h2 className="text-xl font-semibold">Open a project</h2>
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <ProjectGrid
            projects={projects}
            onProjectClick={handleProjectClick}
            onCreateProject={handleCreateProject}
            showCreateButton={true}
            showSearch={true}
          />
        </div>
      </div>
    </Modal>
  );
}
