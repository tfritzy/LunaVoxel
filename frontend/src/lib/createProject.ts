import { generateId } from "./idGenerator";
import { NavigateFunction } from "react-router-dom";
import { DbConnection } from "@/module_bindings";

export const createProject = async (
  connection: DbConnection | null,
  navigate: NavigateFunction,
  name: string = "Untitled project"
): Promise<string | null> => {
  const id = generateId("pjct");

  if (!connection || !connection.identity || !connection.token) {
    console.error("No valid connection or identity found");
    return null;
  }

  connection.reducers.createProject(id, name, 64, 64, 64);

  navigate(`/project/${id}`);
  return id;
};
