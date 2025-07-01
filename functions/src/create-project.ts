import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getStorage } from "firebase-admin/storage";
import { adminApp, spacetimeUrl } from ".";
import { createCanvas } from "canvas";
import { validateSpacetimeIdentity } from "./identity-validation";

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

const generateDefaultColorPalette = (): string[] => {
  return [
    "#FF0000",
    "#FF4000",
    "#FF8000",
    "#FFBF00",
    "#FFFF00",
    "#BFFF00",
    "#80FF00",
    "#40FF00",
    "#00FF00",
    "#00FF40",
    "#00FF80",
    "#00FFBF",
    "#00FFFF",
    "#00BFFF",
    "#0080FF",
    "#0040FF",
    "#0000FF",
    "#4000FF",
    "#8000FF",
    "#BF00FF",
    "#FF00FF",
    "#FF00BF",
    "#FF0080",
    "#FF0040",
    "#800000",
    "#804000",
    "#808000",
    "#80BF00",
    "#80FF00",
    "#408000",
    "#008000",
    "#008040",
    "#008080",
    "#0080BF",
    "#008080",
    "#004080",
    "#000080",
    "#400080",
    "#800080",
    "#BF0080",
    "#FF0080",
    "#800040",
    "#400000",
    "#404000",
    "#808040",
    "#404040",
    "#808080",
    "#C0C0C0",
    "#FFFFFF",
    "#000000",
    "#404080",
    "#8040C0",
    "#C040FF",
    "#FF40C0",
    "#FF4080",
    "#FF8040",
    "#FFC040",
    "#FFFF40",
    "#C0FF40",
    "#80FF40",
    "#40FF80",
    "#40FFC0",
    "#40C0FF",
    "#4080FF",
  ];
};

export const createProject = onCall<
  CreateProjectRequest,
  Promise<CreateProjectResponse>
>(async (request) => {
  const { id, name, xDim, yDim, zDim, userIdentity, spacetimeToken } =
    request.data;

  try {
    if (
      !id ||
      !name ||
      !xDim ||
      !yDim ||
      !zDim ||
      !userIdentity ||
      !spacetimeToken
    ) {
      throw new Error("Missing required parameters");
    }

    logger.info(`Validating identity for user: ${userIdentity}`);

    const isValidIdentity = await validateSpacetimeIdentity(
      userIdentity,
      spacetimeToken
    );
    if (!isValidIdentity) {
      throw new Error("Invalid SpaceTime identity or token");
    }

    const spacetimeHost = spacetimeUrl.value();
    const isDev = spacetimeHost.includes("localhost");
    const protocol = isDev ? "http" : "https";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${spacetimeToken}`,
    };

    logger.info(`Creating project: ${id} - ${name} for user: ${userIdentity}`);

    const createProjectResponse = await fetch(
      `${protocol}://${spacetimeHost}/v1/database/lunavoxel/call/CreateProject`,
      {
        method: "POST",
        headers,
        body: JSON.stringify([id, name, xDim, yDim, zDim]),
      }
    );

    if (!createProjectResponse.ok) {
      const errorText = await createProjectResponse.text();
      logger.error("SpacetimeDB create project failed:", errorText);
      throw new Error(
        `SpacetimeDB error: ${createProjectResponse.status} ${errorText}`
      );
    }

    logger.info("Project created in SpacetimeDB, generating default atlas");

    const cellSize = 1;
    const gridSize = 8;
    const canvasSize = gridSize * cellSize;
    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext("2d");

    const colors = generateDefaultColorPalette();

    for (let i = 0; i < 64; i++) {
      const col = i % gridSize;
      const row = Math.floor(i / gridSize);
      const x = col * cellSize;
      const y = row * cellSize;

      ctx.fillStyle = colors[i] || "#000000";
      ctx.fillRect(x, y, cellSize, cellSize);
    }

    const buffer = canvas.toBuffer("image/png");

    logger.info("Generated default atlas, uploading to storage");

    const bucket = getStorage(adminApp).bucket();
    const atlasFile = bucket.file(`atlases/${id}.png`);

    await atlasFile.save(buffer, {
      metadata: {
        contentType: "image/png",
      },
    });

    logger.info("Atlas uploaded, updating atlas in SpacetimeDB");

    const updateAtlasResponse = await fetch(
      `${protocol}://${spacetimeHost}/v1/database/lunavoxel/call/UpdateAtlas`,
      {
        method: "POST",
        headers,
        body: JSON.stringify([id, 8, true, 1]),
      }
    );

    if (!updateAtlasResponse.ok) {
      const errorText = await updateAtlasResponse.text();
      logger.error("SpacetimeDB update atlas failed:", errorText);
      throw new Error(
        `SpacetimeDB update atlas error: ${updateAtlasResponse.status} ${errorText}`
      );
    }

    logger.info(`Project ${id} created successfully with default atlas`);

    return {
      success: true,
      projectId: id,
    };
  } catch (error) {
    logger.error("Error creating project:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});
