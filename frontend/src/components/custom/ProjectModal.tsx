import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useUserProjects, type Project } from "@/state";
import { createProject } from "@/lib/createProject";
import { Plus, Search, FolderOpen } from "lucide-react";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatTimestamp = (ts: number): string => {
  const elapsed = Date.now() - ts;
  const mins = Math.floor(elapsed / 60000);
  const hrs = Math.floor(elapsed / 3600000);
  const days = Math.floor(elapsed / 86400000);
  
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
};

export const ProjectModal = ({ isOpen, onClose }: ProjectModalProps) => {
  const nav = useNavigate();
  const { userProjects, sharedProjects } = useUserProjects();
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);

  const combined = [...userProjects, ...sharedProjects];
  const sorted = combined.sort((a, b) => b.updated - a.updated);
  
  const visible = filter.trim() 
    ? sorted.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()))
    : sorted;

  const openProject = (id: string) => {
    nav(`/project/${id}`);
    onClose();
  };

  const newProject = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await createProject(nav);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (isOpen) setFilter("");
  }, [isOpen]);

  const ProjectItem = ({ proj }: { proj: Project }) => (
    <div
      onClick={() => openProject(proj.id)}
      className="p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-accent/30 cursor-pointer transition-all"
    >
      <div className="font-medium truncate mb-1">{proj.name}</div>
      <div className="text-xs text-muted-foreground">{formatTimestamp(proj.updated)}</div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Open project" size="3xl">
      <div className="p-6 min-h-[400px]">
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={newProject} disabled={creating}>
            <Plus className="w-4 h-4 mr-2" />
            {creating ? "Creating..." : "New"}
          </Button>
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {filter ? "No matching projects" : "No projects yet"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {visible.map((p) => <ProjectItem key={p.id} proj={p} />)}
          </div>
        )}
      </div>
    </Modal>
  );
};
