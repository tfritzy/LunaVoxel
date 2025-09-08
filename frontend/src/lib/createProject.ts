import { generateId } from "./idGenerator";
import { NavigateFunction } from "react-router-dom";
import { DbConnection } from "@/module_bindings";

export const createProject = async (
  connection: DbConnection | null,
  navigate: NavigateFunction,
  name: string = "Untitled project"
) => {
  const id = generateId("pjct");

  if (!connection || !connection.identity || !connection.token) {
    console.error("No valid connection or identity found");
    return { success: false, error: "No valid connection or identity found" };
  }

  connection.reducers.createProject(id, name, 32, 32, 32);
};
