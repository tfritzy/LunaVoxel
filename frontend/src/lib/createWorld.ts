import { DbConnection } from "@/module_bindings";
import { generateWorldName } from "./nameGenerator";
import { generateId } from "./idGenerator";
import { NavigateFunction } from "react-router-dom";

export function createWorld(
  connection: DbConnection,
  navigate: NavigateFunction
) {
  const id = generateId("world");
  connection?.reducers.createWorld(id, generateWorldName(), 32, 32, 32);
  navigate(`/worlds/${id}`);
}
