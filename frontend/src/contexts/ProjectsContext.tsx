import { DbConnection, Project } from "@/module_bindings";
import { useCallback, useMemo } from "react";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useQueryRunner } from "@/lib/useQueryRunner";

interface UseProjectsReturn {
  userProjects: Project[];
  sharedProjects: Project[];
}

export function useProjects(): UseProjectsReturn {
  const { connection } = useDatabase();

  const getTable = useCallback((db: DbConnection) => db.db.projects, []);
  const { data: projects } = useQueryRunner(connection, getTable);

  const { userProjects, sharedProjects } = useMemo(() => {
    if (!connection?.identity) {
      return { userProjects: [], sharedProjects: [] };
    }

    const user: Project[] = [];
    const shared: Project[] = [];

    for (const project of projects) {
      if (project.owner.isEqual(connection.identity)) {
        user.push(project);
      } else {
        shared.push(project);
      }
    }

    return { userProjects: user, sharedProjects: shared };
  }, [projects, connection?.identity]);

  return { userProjects, sharedProjects };
}
