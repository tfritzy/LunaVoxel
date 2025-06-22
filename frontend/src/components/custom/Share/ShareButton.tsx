import { useState } from "react";
import { Users } from "lucide-react";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { ShareModal } from "./ShareModal";
import { Button } from "@/components/ui/button";

export function ShareButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { project } = useCurrentProject();

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="lg"
        className="rounded-2xl"
      >
        <Users className="h-4 w-4" />
        Share
      </Button>

      <ShareModal
        projectId={project.id}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
