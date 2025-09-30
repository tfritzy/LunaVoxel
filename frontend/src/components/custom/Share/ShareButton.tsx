import { useState } from "react";
import { Eye, Users } from "lucide-react";
import { ShareModal } from "./ShareModal";
import { Button } from "@/components/ui/button";
import { useParams } from "react-router-dom";
import { AccessType } from "@/module_bindings";

export function ShareButton({
  accessLevel,
}: {
  accessLevel: AccessType | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const projectId = useParams().projectId || "";

  if (accessLevel?.tag !== "ReadWrite") {
    return (
      <div className="border border-border text-sm px-4 py-2 rounded-full bg-muted flex flex-row space-x-2 items-center">
        <Eye size={20} />
        <div>View only</div>
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="lg"
        className="rounded-full"
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
