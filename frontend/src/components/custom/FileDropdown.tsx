import { Plus, FolderOpen, FileDown, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FileDropdownProps {
  onNewProject: () => void;
  onOpenProject: () => void;
}

export function FileDropdown({
  onNewProject,
  onOpenProject,
}: FileDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-muted-foreground">
          File
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={onNewProject}>
          <Plus className="mr-2 h-4 w-4" />
          New
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenProject}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Open
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled onClick={onOpenProject}>
          <FileDown className="mr-2 h-4 w-4" />
          Export (WIP)
        </DropdownMenuItem>
        <DropdownMenuItem disabled onClick={onOpenProject}>
          <FileUp className="mr-2 h-4 w-4" />
          Import (WIP)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
