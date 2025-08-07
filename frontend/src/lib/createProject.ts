import { getFunctions, httpsCallable } from "firebase/functions";
import { generateId } from "./idGenerator";
import { NavigateFunction } from "react-router-dom";
import { DbConnection } from "@/module_bindings";

interface CreateProjectRequest {
  id: string;
  name: string;
  xDim: number;
  yDim: number;
  zDim: number;
  userIdentity: string;
  spacetimeToken: string;
}

interface CreateProjectResponse {
  success: boolean;
  projectId?: string;
  error?: string;
}

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

  try {
    const functions = getFunctions();
    const createProjectFunction = httpsCallable<
      CreateProjectRequest,
      CreateProjectResponse
    >(functions, "createProject");

    const result = await createProjectFunction({
      id,
      name,
      xDim: 64,
      yDim: 64,
      zDim: 64,
      userIdentity: connection.identity.toHexString(),
      spacetimeToken: connection.token,
    });

    if (result.data.success) {
      navigate(`/project/${id}`);
      return { success: true, projectId: id };
    } else {
      console.error("Failed to create project:", result.data.error);
      return { success: false, error: result.data.error };
    }
  } catch (error) {
    console.error("Error calling createProject function:", error);
    return { success: false, error: "Failed to create project" };
  }
};
