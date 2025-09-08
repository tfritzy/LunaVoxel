import { useCallback } from "react";
import { DbConnection, Project } from "@/module_bindings";
import { useQueryRunner } from "./useQueryRunner";

export function useCurrentProject(
  db: DbConnection | null,
  projectId: string
): Project {
  const getTable = useCallback((db: DbConnection) => db.db.projects, []);
  const { data: projects } = useQueryRunner(db, getTable);
  const project = projects.find((p) => p.id === projectId);
  return project!;
}
