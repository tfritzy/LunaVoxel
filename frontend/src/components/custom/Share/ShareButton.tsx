import { useState } from "react";
import { Users } from "lucide-react";
import { ShareModal } from "./ShareModal";
import { Button } from "@/components/ui/button";
import { useProjectMeta } from "@/contexts/CurrentProjectContext";

export function ShareButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { project } = useProjectMeta();

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
