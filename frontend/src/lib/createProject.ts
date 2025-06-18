import { DbConnection } from "@/module_bindings";
import { generateId } from "./idGenerator";
import { NavigateFunction } from "react-router-dom";

export function createProject(
  connection: DbConnection,
  navigate: NavigateFunction
) {
  const id = generateId("pjct");
  connection?.reducers.createProject(id, "Untitled project", 32, 32, 32);
  navigate(`/project/${id}`);
}
