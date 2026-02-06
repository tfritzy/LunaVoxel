import type { Project } from "@/state/types";
import { useMemo } from "react";
import { useGlobalState } from "@/state/store";

interface UseProjectsReturn {
  userProjects: Project[];
  sharedProjects: Project[];
}

export function useProjects(): UseProjectsReturn {
  const project = useGlobalState((state) => state.project);

  const { userProjects, sharedProjects } = useMemo(() => {
    return { userProjects: [project], sharedProjects: [] };
  }, [project]);

  return { userProjects, sharedProjects };
}
