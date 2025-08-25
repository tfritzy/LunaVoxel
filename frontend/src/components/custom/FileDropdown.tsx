import { Plus, FolderOpen, FileDown, FileUp } from "lucide-react";
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
import { ExportType } from "@/modeling/export/model-exporter";
import { useCallback } from "react";

interface FileDropdownProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onExport: (type: ExportType) => void;
}

export function FileDropdown({
  onNewProject,
  onOpenProject,
  onExport,
}: FileDropdownProps) {
  const obj = useCallback(() => onExport("OBJ"), [onExport]);
  const gltf = useCallback(() => onExport("GLTF"), [onExport]);

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
          <DropdownMenuSubTrigger>
            <FileUp className="mr-2 h-4 w-4" />
            Export
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={obj}>Wavefront (.obj)</DropdownMenuItem>
            <DropdownMenuItem onClick={gltf}>GLTF (.gltf)</DropdownMenuItem>
            <DropdownMenuItem disabled>STL (Coming Soon)</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
