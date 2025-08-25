import { useState } from "react";
import { Users } from "lucide-react";
import { ShareModal } from "./ShareModal";
import { Button } from "@/components/ui/button";
import { useParams } from "react-router-dom";

export function ShareButton() {
  const [isOpen, setIsOpen] = useState(false);
  const projectId = useParams().projectId || "";

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="lg"
        className=""
      >
        <Users className="h-4 w-4" />
        Share
      </Button>

      <ShareModal
        projectId={projectId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
