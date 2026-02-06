import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportType } from "@/modeling/export/model-exporter";
import { useCallback } from "react";

interface FileDropdownProps {
  onExport: (type: ExportType) => void;
}

export function FileDropdown({
  onExport,
}: FileDropdownProps) {
  const obj = useCallback(() => onExport("OBJ"), [onExport]);
  const gltf = useCallback(() => onExport("GLTF"), [onExport]);
  const stl = useCallback(() => onExport("STL"), [onExport]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-muted-foreground">
          File
        </Button>
      </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileUp className="mr-2 h-4 w-4" />
            Export
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={obj}>Wavefront (.obj)</DropdownMenuItem>
            <DropdownMenuItem onClick={gltf}>GLTF (.gltf)</DropdownMenuItem>
            <DropdownMenuItem onClick={stl}>STL (.stl)</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
