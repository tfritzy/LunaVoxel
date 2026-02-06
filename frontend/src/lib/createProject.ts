import { stateStore } from "@/state/store";

export const createProject = async (
  _connection: unknown | null,
  _navigate: unknown,
  name: string = "Untitled project"
): Promise<string | null> => {
  const projectId = stateStore.getState().project.id;
  stateStore.reducers.updateProjectName(projectId, name);
  return projectId;
};
