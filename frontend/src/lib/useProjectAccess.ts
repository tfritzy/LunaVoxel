import { AccessType, DbConnection } from "@/module_bindings";
import { useEffect, useState } from "react";
import { ProjectAccessManager } from "./projectAccessManager";

export const useProjectAccess = (
  connection: DbConnection | null,
  projectId: string
) => {
  const [hasWriteAccess, setHasWriteAccess] = useState(false);
  const [accessLevel, setAccessLevel] = useState<AccessType | null>(null);

  useEffect(() => {
    if (!connection || !projectId) return;

    new ProjectAccessManager(
      connection,
      projectId,
      connection.identity?.toHexString(),
      (writeAccess, level) => {
        setHasWriteAccess(writeAccess);
        setAccessLevel(level);
      }
    );
  }, [connection, projectId]);

  return { hasWriteAccess, accessLevel };
};
