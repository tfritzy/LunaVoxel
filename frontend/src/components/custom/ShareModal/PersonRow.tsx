import { AccessType, UserProject } from "@/module_bindings";
import { RoleDropdown } from "./RoleDropdown";
import { useDatabase } from "@/contexts/DatabaseContext";
import React from "react";

export function PersonRow({
  userProject,
  isCurrentUser,
  isOwner,
}: {
  userProject: UserProject;
  isCurrentUser: boolean;
  isOwner: boolean;
}) {
  const { connection } = useDatabase();
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

  const handleAccessChange = React.useCallback(
    (accessType: AccessType["tag"]) => {
      if (!connection || !userProject.email) return;

      connection.reducers.changeAccessToProject(
        userProject.projectId,
        userProject.email,
        { tag: accessType }
      );
    },
    [connection, userProject]
  );

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
        onRoleChange={handleAccessChange}
        allowRemove
        onRemove={function (): void {
          throw new Error("Function not implemented.");
        }}
      />
    </div>
  );
}
