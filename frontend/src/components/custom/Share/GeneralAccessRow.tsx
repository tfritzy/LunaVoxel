import { Link, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function GeneralAccessRow({
  generalAccess,
}: {
  generalAccess: "private" | "link_viewer" | "link_editor";
}) {
  const getAccessLabel = (access: string) => {
    switch (access) {
      case "private":
        return "Restricted";
      case "link_viewer":
        return "Anyone with the link";
      case "link_editor":
        return "Anyone with the link";
      default:
        return "Restricted";
    }
  };

  const getAccessDescription = (access: string) => {
    switch (access) {
      case "private":
        return "Only people with access can open with the link";
      case "link_viewer":
        return "Anyone on the internet with the link can view";
      case "link_editor":
        return "Anyone on the internet with the link can edit";
      default:
        return "Only people with access can open with the link";
    }
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
        <Link className="w-5 h-5 text-secondary-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">
          General Access
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {getAccessDescription(generalAccess)}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 px-3 py-1 text-sm text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors">
          {getAccessLabel(generalAccess)}
          <ChevronDown className="w-4 h-4" />
        </DropdownMenuTrigger>
        {/* <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onGeneralAccessChange("private")}>
            <div className="text-sm font-medium text-popover-foreground">
              Restricted
            </div>
            <div className="text-xs text-muted-foreground">
              Only people with access can open with the link
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onGeneralAccessChange("link_viewer")}
          >
            <div className="text-sm font-medium text-popover-foreground">
              Anyone with the link (Viewer)
            </div>
            <div className="text-xs text-muted-foreground">
              Anyone on the internet with the link can view
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onGeneralAccessChange("link_editor")}
          >
            <div className="text-sm font-medium text-popover-foreground">
              Anyone with the link (Editor)
            </div>
            <div className="text-xs text-muted-foreground">
              Anyone on the internet with the link can edit
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent> */}
      </DropdownMenu>
    </div>
  );
}
