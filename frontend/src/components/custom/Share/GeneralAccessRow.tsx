import { Link, ChevronDown, Earth } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Project, AccessType } from "@/module_bindings";
import { useDatabase } from "@/contexts/DatabaseContext";
import { toast } from "sonner";

export const GeneralAccessRow = ({ project }: { project: Project }) => {
  console.log("project", project);
  const { connection } = useDatabase();
  const getAccessLabel = (access: AccessType) => {
    switch (access.tag) {
      case "None":
        return "Restricted";
      case "Read":
      case "ReadWrite":
        return "Anyone with the link";
      default:
        return "Restricted";
    }
  };
  const getAccessDescription = (access: AccessType) => {
    switch (access.tag) {
      case "None":
        return "Only people with direct access can open this project";
      case "Read":
        return "Anyone on the internet with the link can view";
      case "ReadWrite":
        return "Anyone on the internet with the link can edit";
      default:
        return "Only people with access can open with the link";
    }
  };
  const getRoleLabel = (access: AccessType) => {
    switch (access.tag) {
      case "Read":
        return "Viewer";
      case "ReadWrite":
        return "Editor";
      default:
        return "";
    }
  };
  const onGeneralAccessChange = (accessTag: string) => {
    if (!connection) return;

    const access = { tag: accessTag } as AccessType;
    connection.reducers.changePublicAccessToProject(project.id, access);
    toast.success("Project access updated");
  };

  const isLinkAccess = project.publicAccess.tag !== "None";

  return (
    <div className="flex items-center gap-3 py-2">
      {isLinkAccess ? (
        <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
          <Earth className="w-8 h-8 text-green-700" />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
          <Link className="w-5 h-5 text-secondary-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 px-2 py-1 text-sm text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors">
            {getAccessLabel(project.publicAccess)}
            <ChevronDown className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {" "}
            <DropdownMenuItem onClick={() => onGeneralAccessChange("None")}>
              <div>
                <div className="text-sm font-medium text-popover-foreground">
                  Restricted
                </div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onGeneralAccessChange("Read")}>
              <div>
                <div className="text-sm font-medium text-popover-foreground">
                  Anyone with the link
                </div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="text-xs text-muted-foreground mt-1 pl-2">
          {getAccessDescription(project.publicAccess)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isLinkAccess && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 px-3 py-1 text-sm text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors">
              {getRoleLabel(project.publicAccess)}
              <ChevronDown className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {" "}
              <DropdownMenuItem onClick={() => onGeneralAccessChange("Read")}>
                <div className="text-sm font-medium text-popover-foreground">
                  Viewer
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onGeneralAccessChange("ReadWrite")}
              >
                <div className="text-sm font-medium text-popover-foreground">
                  Editor
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};
