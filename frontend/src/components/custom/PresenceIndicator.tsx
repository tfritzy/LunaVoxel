import React, { useEffect, useState } from "react";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useParams } from "react-router-dom";
import { PlayerCursor } from "@/module_bindings";
import { CURSOR_COLORS } from "@/modeling/lib/cursor-manager";
import { Avatar } from "./Avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const PresenceIndicator = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { connection } = useDatabase();
  const [presenceUsers, setPresenceUsers] = useState<PlayerCursor[]>([]);

  const getColorForPlayer = React.useCallback(
    (playerId: string, index: number): string => {
      return CURSOR_COLORS[index % CURSOR_COLORS.length].getHexString();
    },
    []
  );

  useEffect(() => {
    if (!projectId || !connection) return;

    const updatePresence = () => {
      const cursors: PlayerCursor[] = [];
      for (const cursor of connection.db.playerCursor.tableCache.iter()) {
        const c = cursor as PlayerCursor;
        if (c.projectId === projectId) {
          cursors.push(c);
        }
      }

      const currentUserIdentity = connection.identity;
      const otherUsers = cursors.filter(
        (cursor) =>
          currentUserIdentity && !cursor.player.isEqual(currentUserIdentity)
      );

      const uniqueUsers = new Map<string, PlayerCursor>();
      otherUsers.forEach((cursor) => {
        const playerKey = cursor.player.toHexString();
        if (!uniqueUsers.has(playerKey)) {
          uniqueUsers.set(playerKey, cursor);
        }
      });

      const users: PlayerCursor[] = Array.from(uniqueUsers.values());

      const now = new Date();
      const filteredUsers = users.filter((user) => {
        if (!user.lastUpdated) return true;
        const minutesSince = Math.floor(
          (now.getTime() - user.lastUpdated.toDate().getTime()) / (1000 * 60)
        );
        return minutesSince <= 10;
      });

      setPresenceUsers(filteredUsers);
    };

    updatePresence();

    connection.db.playerCursor.onInsert(() => {
      updatePresence();
    });

    connection.db.playerCursor.onDelete(() => {
      updatePresence();
    });

    connection.db.playerCursor.onUpdate(() => {
      updatePresence();
    });
  }, [projectId, connection, getColorForPlayer]);

  if (presenceUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center -space-x-1">
      {presenceUsers.slice(0, 5).map((user) => (
        <Avatar
          id={user.id}
          displayName={user.displayName}
          showTooltip
          updatedAt={user.lastUpdated}
          key={user.id}
        />
      ))}
      {presenceUsers.length > 5 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="w-8 h-8 rounded-full border border-white bg-card flex items-center justify-center text-xs font-medium text-white shadow-sm cursor-pointer"
                style={{
                  marginLeft: "-8px",
                  zIndex: 5,
                }}
              >
                +{presenceUsers.length - 5}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <div className="font-medium">
                  {presenceUsers.length - 5} more user
                  {presenceUsers.length - 5 !== 1 ? "s" : ""}
                </div>
                <div className="text-xs opacity-80">viewing this project</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};
