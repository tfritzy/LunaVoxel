import React, { useEffect, useState } from "react";
import { X, Link, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { Button } from "../ui/button";
import { AccessType, User, UserProject } from "@/module_bindings";

type UserProjectWithEmail = UserProject & {
  email?: string;
};

interface ShareModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface PersonRowProps {
  userProject: UserProject;
  currentUserId: string;
  onRoleChange: (
    userProjectId: string,
    newRole: "owner" | "editor" | "viewer"
  ) => void;
  onRemove: (userProjectId: string) => void;
}

interface GeneralAccessRowProps {
  generalAccess: "private" | "link_viewer" | "link_editor";
  onGeneralAccessChange: (
    access: "private" | "link_viewer" | "link_editor"
  ) => void;
}

const getRoleLabel = (role: AccessType["tag"]) => {
  switch (role) {
    case AccessType.ReadWrite.tag:
      return "Editor";
    case AccessType.Read.tag:
      return "Viewer";
    default:
      return "Viewer";
  }
};

function RoleDropdown({
  disabled,
  role,
  onRoleChange,
  allowRemove,
  onRemove,
}: {
  disabled: boolean;
  role: AccessType;
  onRoleChange: (role: AccessType["tag"]) => void;
  allowRemove: boolean;
  onRemove: () => void;
}) {
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
        className={cn(
          "flex items-center gap-1 px-3 py-1 text-sm rounded-md transition-colors",
          disabled
            ? "text-muted-foreground cursor-default"
            : "text-foreground hover:bg-accent hover:text-accent-foreground"
        )}
        disabled={disabled}
      >
        {getRoleLabel(role.tag)}
        {!disabled && <ChevronDown className="w-4 h-4" />}
      </button>

      {isRoleDropdownOpen && !disabled && (
        <div className="absolute right-0 mt-1 w-32 bg-popover border border-border rounded-md shadow-md z-10">
          <button
            onClick={() => {
              onRoleChange("ReadWrite");
              setIsRoleDropdownOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {role.tag === "ReadWrite" && <Check />}
            Editor
          </button>

          <button
            onClick={() => {
              onRoleChange("Read");
              setIsRoleDropdownOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground border-t border-border"
          >
            {role.tag === "Read" && <Check />}
            Viewer
          </button>
          {!allowRemove && (
            <button
              onClick={() => {
                onRemove();
                setIsRoleDropdownOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-destructive/10"
            >
              Remove access
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const PersonRow: React.FC<PersonRowProps> = ({
  userProject,
  currentUserId,
  onRoleChange,
  onRemove,
}) => {
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const isCurrentUser = userProject.userId === currentUserId;
  const isOwner = userProject.role === "owner";

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
          {userProject.user.email}
          {isCurrentUser && (
            <span className="text-muted-foreground"> (you)</span>
          )}
        </div>
        {userProject.user.name && (
          <div className="text-sm text-muted-foreground">
            {userProject.user.name}
          </div>
        )}
      </div>

      <RoleDropdown
        disabled={isOwner}
        role={userProject.user}
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
};

const GeneralAccessRow: React.FC<GeneralAccessRowProps> = ({
  generalAccess,
  onGeneralAccessChange,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  const getRoleLabel = (access: string) => {
    switch (access) {
      case "link_viewer":
        return "Viewer";
      case "link_editor":
        return "Editor";
      default:
        return "";
    }
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
        <Link className="w-5 h-5 text-secondary-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-2 py-1 transition-colors"
          >
            {getAccessLabel(generalAccess)}
            <ChevronDown className="w-4 h-4" />
          </button>

          {isDropdownOpen && (
            <div className="absolute left-0 mt-1 w-64 bg-popover border border-border rounded-md shadow-md z-10">
              <button
                onClick={() => {
                  onGeneralAccessChange("private");
                  setIsDropdownOpen(false);
                }}
                className="block w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
              >
                <div className="text-sm font-medium text-popover-foreground">
                  Restricted
                </div>
                <div className="text-xs text-muted-foreground">
                  Only people with access can open with the link
                </div>
              </button>
              <button
                onClick={() => {
                  onGeneralAccessChange("link_viewer");
                  setIsDropdownOpen(false);
                }}
                className="block w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
              >
                <div className="text-sm font-medium text-popover-foreground">
                  Anyone with the link
                </div>
                <div className="text-xs text-muted-foreground">
                  Anyone on the internet with the link can view
                </div>
              </button>
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {getAccessDescription(generalAccess)}
        </div>
      </div>

      {generalAccess !== "private" && (
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1 px-3 py-1 text-sm text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
          >
            {getRoleLabel(generalAccess)}
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const [addPeopleValue, setAddPeopleValue] = useState("");
  const { project } = useCurrentProject();
  const { connection } = useDatabase();
  const [userProjects, setUserProjects] = useState<UserProject[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userProjectsWithEmail, setUserProjectsWithEmail] = useState<
    UserProjectWithEmail[]
  >([]);

  useEffect(() => {
    if (!connection?.identity || !project.id) return;
    const userProjectsSub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        setUserProjects(
          (
            connection.db.userProjects.tableCache.iter() as UserProject[]
          ).filter((p) => p.projectId === project.id)
        );
      })
      .onError((error) => {
        console.error("User projects subscription error:", error);
      })
      .subscribe([
        `SELECT * FROM user_projects WHERE ProjectId='${project.id}'`,
      ]);
    const usersSub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        setUsers(connection.db.user.tableCache.iter());
      })
      .onError((error) => {
        console.error("Users subscription error:", error);
      })
      .subscribe([
        `SELECT u.* FROM user u JOIN user_projects up ON u.Identity = up.User WHERE up.ProjectId='${project.id}'`,
      ]);
    return () => {
      userProjectsSub.unsubscribe();
      usersSub.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const combined = userProjects.map((userProject) => {
      const user = users.find((u) => u.identity.isEqual(userProject.user));
      return {
        ...userProject,
        email: user?.email,
      };
    });
    setUserProjectsWithEmail(combined);
  }, [userProjects, users]);

  console.log("User projects with email:", userProjectsWithEmail);

  const handleAddPeople = () => {
    if (!addPeopleValue.trim()) return;

    // TODO: Call addUserToProject reducer
    console.log("TODO: Add people:", addPeopleValue);
    setAddPeopleValue("");
  };

  const handleRoleChange = (
    userProjectId: string,
    newRole: "owner" | "editor" | "viewer"
  ) => {
    // TODO: Call updateUserProjectRole reducer
    console.log("TODO: Update role:", userProjectId, newRole);
  };

  const handleRemoveUser = (userProjectId: string) => {
    // TODO: Call removeUserFromProject reducer
    console.log("TODO: Remove user:", userProjectId);
  };

  const handleGeneralAccessChange = (
    access: "private" | "link_viewer" | "link_editor"
  ) => {
    // TODO: Call updateProjectGeneralAccess reducer
    console.log("TODO: Update general access:", access);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddPeople();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg w-full max-w-md mx-4 max-h-[90vh] overflow-hidden shadow-lg border border-border">
        <div className="p-6 border-b border-border">
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

          <div className="mt-4 flex flex-row space-x-2 justify-between">
            <input
              type="text"
              value={addPeopleValue}
              onChange={(e) => setAddPeopleValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="jenny@example.com"
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />

            <Button variant="outline">Invite</Button>
          </div>
        </div>

        <div className="p-6 max-h-96 overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-card-foreground mb-3">
              People with access
            </h3>
            <div className="space-y-1">
              {userProjects.map((userProject) => (
                <PersonRow
                  key={userProject.id}
                  userProject={userProject}
                  currentUserId={connection!.identity!.toHexString()}
                  onRoleChange={handleRoleChange}
                  onRemove={handleRemoveUser}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-card-foreground mb-3">
              General access
            </h3>
            <GeneralAccessRow
              generalAccess={project.generalAccess}
              onGeneralAccessChange={handleGeneralAccessChange}
            />
          </div>
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
  );
};
