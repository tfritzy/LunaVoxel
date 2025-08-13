import React, { useEffect, useState } from "react";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useParams } from "react-router-dom";
import { PlayerCursor } from "@/module_bindings";
import { CURSOR_COLORS } from "@/modeling/lib/cursor-manager";
import { Avatar } from "./Avatar";

export function PresenceIndicator() {
  const { projectId } = useParams<{ projectId: string }>();
  const { connection } = useDatabase();
  const [presenceUsers, setPresenceUsers] = useState<PlayerCursor[]>([]);

  const getInitials = (name: string): string => {
    const hex = name.slice(-4);
    const char1 = String.fromCharCode(
      65 + (parseInt(hex.slice(0, 2), 16) % 26)
    );
    const char2 = String.fromCharCode(
      65 + (parseInt(hex.slice(2, 4), 16) % 26)
    );
    return char1 + char2;
  };

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
      setPresenceUsers(users);
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
      {presenceUsers.slice(0, 5).map((user, index) => (
        <Avatar id={user.id} name={user.displayName} showTooltip />
      ))}
      {presenceUsers.length > 5 && (
        <div
          className="w-8 h-8 rounded-full border border-white bg-gray-500 flex items-center justify-center text-xs font-medium text-white shadow-sm"
          style={{
            marginLeft: "-8px",
            zIndex: 5,
          }}
          title={`${presenceUsers.length - 5} more users viewing this project`}
        >
          +{presenceUsers.length - 5}
        </div>
      )}
    </div>
  );
}
