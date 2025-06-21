import React, { useEffect, useState } from "react";
import { X, Link, ChevronDown } from "lucide-react";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { AccessType, EventContext, UserProject } from "@/module_bindings";
import { RoleDropdown } from "./RoleDropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InviteForm } from "./InviteForm";

interface ShareModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface GeneralAccessRowProps {
  generalAccess: "private" | "link_viewer" | "link_editor";
  onGeneralAccessChange: (
    access: "private" | "link_viewer" | "link_editor"
  ) => void;
}

function PersonRow({
  userProject,
  isCurrentUser,
  onRoleChange,
  onRemove,
  isOwner,
}: {
  userProject: UserProject;
  isCurrentUser: boolean;
  isOwner: boolean;
  onRoleChange: (
    userProjectId: string,
    newRole: "owner" | "editor" | "viewer"
  ) => void;
  onRemove: (userProjectId: string) => void;
}) {
  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "U";
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
        {getInitials("Joff", "joff@example.com")}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">
          {userProject.email}
          {isCurrentUser && (
            <span className="text-muted-foreground"> (you)</span>
          )}
        </div>
      </div>

      <RoleDropdown
        disabled={isOwner}
        role={userProject.accessType.tag}
        onRoleChange={function (role: AccessType["tag"]): void {
          throw new Error("Function not implemented.");
        }}
        allowRemove
        onRemove={function (): void {
          throw new Error("Function not implemented.");
        }}
      />
    </div>
  );
}

const GeneralAccessRow: React.FC<GeneralAccessRowProps> = ({
  generalAccess,
  onGeneralAccessChange,
}) => {
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
        <DropdownMenuContent>
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const { project } = useCurrentProject();
  const { connection } = useDatabase();
  const [userProjects, setUserProjects] = useState<UserProject[]>([]);

  useEffect(() => {
    if (!connection?.identity || !project.id) return;

    const userProjectsSub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        const projectUserProjects = Array.from(
          connection.db.userProjects.iter()
        ).filter((up) => up.projectId === project.id);
        setUserProjects(projectUserProjects);
      })
      .onError((error) => {
        console.error("User projects subscription error:", error);
      })
      .subscribe([
        `SELECT * FROM user_projects WHERE ProjectId='${project.id}'`,
      ]);

    const onInsert = (_ctx: EventContext, userProject: UserProject) => {
      if (userProject.projectId === project.id) {
        setUserProjects((prev) => {
          const exists = prev.some((up) => up.email === userProject.email);
          return exists ? prev : [...prev, userProject];
        });
      }
    };

    const onUpdate = (
      _ctx: EventContext,
      oldUserProject: UserProject,
      newUserProject: UserProject
    ) => {
      if (newUserProject.projectId === project.id) {
        setUserProjects((prev) =>
          prev.map((up) =>
            up.email === oldUserProject.email ? newUserProject : up
          )
        );
      }
    };

    const onDelete = (_ctx: EventContext, userProject: UserProject) => {
      if (userProject.projectId === project.id) {
        setUserProjects((prev) =>
          prev.filter((up) => up.email !== userProject.email)
        );
      }
    };

    connection.db.userProjects.onInsert(onInsert);
    connection.db.userProjects.onUpdate(onUpdate);
    connection.db.userProjects.onDelete(onDelete);

    return () => {
      userProjectsSub.unsubscribe();
      connection.db.userProjects.removeOnInsert(onInsert);
      connection.db.userProjects.removeOnUpdate(onUpdate);
      connection.db.userProjects.removeOnDelete(onDelete);
    };
  }, [connection, project.id]);

  const handleRoleChange = (
    userProjectId: string,
    newRole: "owner" | "editor" | "viewer"
  ) => {
    console.log("TODO: Update role:", userProjectId, newRole);
  };

  const handleRemoveUser = (userProjectId: string) => {
    console.log("TODO: Remove user:", userProjectId);
  };

  const handleGeneralAccessChange = (
    access: "private" | "link_viewer" | "link_editor"
  ) => {
    console.log("TODO: Update general access:", access);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="max-h-[90vh] w-xl overflow-y-auto">
        <div className="bg-card rounded-lg mx-4 shadow-lg border border-border">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-card-foreground">
                Share "{project.name}"
              </h2>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="pl-6">
            <div className="flex flex-row space-x-2 justify-between pr-6 mb-4">
              <InviteForm connection={connection!} projectId={project.id} />
            </div>
            <h3 className="text-sm font-medium text-card-foreground my-4">
              People with access
            </h3>
            <div className="max-h-72 overflow-y-auto">
              <div className="space-y-1 pr-6">
                {userProjects.map((userProject) => (
                  <PersonRow
                    key={userProject.user.toString()}
                    userProject={userProject}
                    isCurrentUser={userProject.user.isEqual(
                      connection!.identity!
                    )}
                    isOwner={project.owner.isEqual(userProject.user)}
                    onRoleChange={handleRoleChange}
                    onRemove={handleRemoveUser}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="px-6 my-4">
            <h3 className="text-sm font-medium text-card-foreground mb-3">
              General access
            </h3>
            <GeneralAccessRow
              generalAccess={project.generalAccess}
              onGeneralAccessChange={handleGeneralAccessChange}
            />
          </div>
          <div className="p-6 border-t border-border">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
