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
  onNewWorld: () => void;
  onOpenWorld: () => void;
}

export default function FileDropdown({
  onNewWorld,
  onOpenWorld,
}: FileDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          File
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={onNewWorld}>
          <Plus className="mr-2 h-4 w-4" />
          New
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenWorld}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Open
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled onClick={onOpenWorld}>
          <FileDown className="mr-2 h-4 w-4" />
          Export (WIP)
        </DropdownMenuItem>
        <DropdownMenuItem disabled onClick={onOpenWorld}>
          <FileUp className="mr-2 h-4 w-4" />
          Import (WIP)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
