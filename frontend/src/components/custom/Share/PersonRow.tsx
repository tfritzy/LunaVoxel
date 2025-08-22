import { AccessType, UserProject } from "@/module_bindings";
import { RoleDropdown } from "./RoleDropdown";
import { useDatabase } from "@/contexts/DatabaseContext";
import React from "react";
import { Crown } from "lucide-react";
import { getAvatarGradient } from "@/lib/getAvatarColor";

const getInitials = (email: string): string => {
  const parts = email.split("@")[0].split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return email.charAt(0).toUpperCase();
};

const getAvatarColor = (email: string, isOwner: boolean): string => {
  if (isOwner) {
    return "bg-gradient-to-br from-amber-400 to-orange-500";
  }
  return getAvatarGradient(email);
};

export const PersonRow = ({
  userProject,
  isCurrentUser,
  isOwner,
}: {
  userProject: UserProject;
  isCurrentUser: boolean;
  isOwner: boolean;
}) => {
  const { connection } = useDatabase();

  const handleAccessChange = React.useCallback(
    (accessType: AccessType["tag"]) => {
      if (!connection || !userProject.email) return;
      connection.reducers.changeUserAccessToProject(
        userProject.projectId,
        userProject.email,
        { tag: accessType }
      );
    },
    [connection, userProject]
  );

  const initials = userProject.email ? getInitials(userProject.email) : "?";
  const avatarColor = getAvatarColor(userProject.email || "", isOwner);

  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className={`relative w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center text-white text-sm font-semibold shadow-md`}
      >
        {initials}
        {isOwner && (
          <div
            title="Owner"
            className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full p-0.5 shadow-sm"
          >
            <Crown className="w-full h-full text-amber-500 fill-amber-500" />
          </div>
        )}
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
      />
    </div>
  );
};
