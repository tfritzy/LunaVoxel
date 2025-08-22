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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-muted-foreground">
          Edit
        </Button>
      </DropdownMenuTrigger>
      {/* <DropdownMenuContent align="start" className="w-48">
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
      </DropdownMenuContent> */}
    </DropdownMenu>
  );
};