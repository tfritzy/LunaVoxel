import { useGlobalState } from "@/state/store";
import type { Project } from "@/state/types";

export function useCurrentProject(
  _db: unknown | null,
  _projectId: string
): Project | undefined {
  void _db;
  void _projectId;
  return useGlobalState((state) => state.project);
}
