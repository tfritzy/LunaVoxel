import { useMemo } from "react";
import type { AccessLevel } from "@/state/types";

export const useProjectAccess = (
  _connection: unknown | null,
  _projectId: string
) => {
  void _connection;
  void _projectId;
  const access = useMemo<AccessLevel>(() => ({ tag: "ReadWrite" }), []);
  return { hasWriteAccess: true, accessLevel: access };
};
