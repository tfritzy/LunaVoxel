import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDatabase } from "@/contexts/DatabaseContext";

export const EditDropdown = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { connection } = useDatabase();

  const handleUndo = () => {
    if (!projectId || !connection) return;
    connection.reducers.undo(projectId);
  };

  const handleRedo = () => {
    if (!projectId || !connection) return;
    connection.reducers.redo(projectId);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.ctrlKey || event.metaKey;

      if (isModifierPressed && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.stopPropagation();

        if (event.shiftKey) {
          console.log("redo");
          handleRedo();
        } else {
          console.log("undo");
          handleUndo();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [projectId, connection]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-muted-foreground">
          Edit
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={handleUndo}>
          <Undo2 className="mr-2 h-4 w-4" />
          Undo
          <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleRedo}>
          <Redo2 className="mr-2 h-4 w-4" />
          Redo
          <DropdownMenuShortcut>⌘⇧Z</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};