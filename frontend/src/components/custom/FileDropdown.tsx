import { Plus, FolderOpen, FileDown, FileUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

interface FileDropdownProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onExportOBJ?: () => void;
}

export function FileDropdown({
  onNewProject,
  onOpenProject,
  onExportOBJ,
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
          Import (WIP)
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={!onExportOBJ}>
            <FileUp className="mr-2 h-4 w-4" />
            Export
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              onClick={onExportOBJ}
              disabled={!onExportOBJ}
            >
              Wavefront (.obj)
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              GLTF (Coming Soon)
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              STL (Coming Soon)
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}