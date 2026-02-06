import { generateId } from "./idGenerator";
import { NavigateFunction } from "react-router-dom";
import { reducers } from "@/state";

export const createProject = async (
  navigate: NavigateFunction,
  name: string = "Untitled project"
): Promise<string | null> => {
  const id = generateId("pjct");

  reducers.createProject(id, name, 64, 64, 64);

  navigate(`/project/${id}`);
  return id;
};
