import { Undo2, Redo2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface EditDropdownProps {
  onUndo: () => void;
  onRedo: () => void;
  onResizeProject: () => void;
}

export const EditDropdown = ({ onUndo, onRedo, onResizeProject }: EditDropdownProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-muted-foreground">
          Edit
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={onUndo} >
          <Undo2 className="mr-2 h-4 w-4" />
          Undo
          <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRedo} >
          <Redo2 className="mr-2 h-4 w-4" />
          Redo
          <DropdownMenuShortcut>⌘⇧Z</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onResizeProject}>
          <Maximize2 className="mr-2 h-4 w-4" />
          Resize Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};