import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Modal } from "../ui/modal";
import { ProjectGrid } from "./ProjectsGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectClick: (projectId: string) => void;
}

export function ProjectModal({
  isOpen,
  onClose,
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
        <div className="px-6 pt-4 pb-2 flex-shrink-0 border-0 border-b border-border">
          <div className="flex flex-row justify-between items-center">
            <h2 className="text-xl font-semibold">Open a project</h2>
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <Tabs defaultValue="recent" className="h-full flex flex-col">
            <div className="px-6 pt-4 border-b border-border">
              <TabsList className="h-auto p-0 bg-transparent space-x-7">
                <TabsTrigger
                  value="recent"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-0 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none border-b-2 border-transparent pb-1"
                >
                  Recent
                </TabsTrigger>
                <TabsTrigger
                  value="shared"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-0 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none border-b-2 border-transparent pb-1"
                >
                  Shared with Me
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="recent" className="flex-1 mt-0">
              <ProjectGrid
                onProjectClick={handleProjectClick}
                onCreateProject={handleCreateProject}
                showCreateButton={true}
                showSearch={true}
                viewMode="my"
              />
            </TabsContent>

            <TabsContent value="shared" className="flex-1 mt-0">
              <ProjectGrid
                onProjectClick={handleProjectClick}
                showCreateButton={false}
                showSearch={true}
                viewMode="shared"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Modal>
  );
}
