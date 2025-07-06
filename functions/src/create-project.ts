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
    "#2e222f",
    "#3e3546",
    "#625565",
    "#966c6c",
    "#ab947a",
    "#694f62",
    "#7f708a",
    "#9babb2",
    "#c7dcd0",
    "#ffffff",
    "#6e2727",
    "#b33831",
    "#ea4f36",
    "#f57d4a",
    "#ae2334",
    "#e83b3b",
    "#fb6b1d",
    "#f79617",
    "#f9c22b",
    "#7a3045",
    "#9e4539",
    "#cd683d",
    "#e6904e",
    "#fbb954",
    "#4c3e24",
    "#676633",
    "#a2a947",
    "#d5e04b",
    "#fbff86",
    "#165a4c",
    "#239063",
    "#1ebc73",
    "#91db69",
    "#cddf6c",
    "#313638",
    "#374e4a",
    "#547e64",
    "#92a984",
    "#b2ba90",
    "#0b5e65",
    "#0b8a8f",
    "#0eaf9b",
    "#30e1b9",
    "#8ff8e2",
    "#323353",
    "#484a77",
    "#4d65b4",
    "#4d9be6",
    "#8fd3ff",
    "#45293f",
    "#6b3e75",
    "#905ea9",
    "#a884f3",
    "#eaaded",
    "#753c54",
    "#a24b6f",
    "#cf657f",
    "#ed8099",
    "#831c5d",
    "#c32454",
    "#f04f78",
    "#f68181",
    "#fca790",
    "#fdcbb0",
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
        body: JSON.stringify([id, gridSize * gridSize, 1]),
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
