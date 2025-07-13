import { Plus, FolderOpen, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDialogs } from "@/contexts/DialogContext";

export function AtlasDropdown() {
  const { setRightSideDrawer } = useDialogs();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-muted-foreground">
          Atlas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={() => setRightSideDrawer("atlas-drawer")}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => console.log("replace")}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Replace (wip)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
