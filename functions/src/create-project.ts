import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getStorage } from "firebase-admin/storage";
import { adminApp } from ".";
import { createCanvas } from "canvas";
import { validateSpacetimeIdentity } from "./identity-validation";
import { callSpacetimeDB } from "./spacetime-client";

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
    "#fdcbb0",
    "#fca790",
    "#f68181",
    "#f04f78",
    "#c32454",
    "#831c5d",
    "#ed8099",
    "#cf657f",
    "#a24b6f",
    "#753c54",
    "#eaaded",
    "#a884f3",
    "#905ea9",
    "#6b3e75",
    "#45293f",
    "#8fd3ff",
    "#4d9be6",
    "#4d65b4",
    "#484a77",
    "#323353",
    "#8ff8e2",
    "#30e1b9",
    "#0eaf9b",
    "#0b8a8f",
    "#0b5e65",
    "#b2ba90",
    "#92a984",
    "#547e64",
    "#374e4a",
    "#313638",
    "#cddf6c",
    "#91db69",
    "#1ebc73",
    "#239063",
    "#165a4c",
    "#fbff86",
    "#d5e04b",
    "#a2a947",
    "#676633",
    "#4c3e24",
    "#fbb954",
    "#e6904e",
    "#cd683d",
    "#9e4539",
    "#7a3045",
    "#f9c22b",
    "#f79617",
    "#fb6b1d",
    "#e83b3b",
    "#ae2334",
    "#f57d4a",
    "#ea4f36",
    "#b33831",
    "#6e2727",
    "#ffffff",
    "#c7dcd0",
    "#9babb2",
    "#7f708a",
    "#694f62",
    "#ab947a",
    "#966c6c",
    "#625565",
    "#3e3546",
    "#2e222f",
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

    logger.info(`Creating project: ${id} - ${name} for user: ${userIdentity}`);

    const createProjectResponse = await callSpacetimeDB(
      "/v1/database/lunavoxel/call/CreateProject",
      "POST",
      [id, name, xDim, yDim, zDim],
      spacetimeToken
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

    const updateAtlasResponse = await callSpacetimeDB(
      "/v1/database/lunavoxel/call/UpdateAtlas",
      "POST",
      [id, gridSize, 1, 64]
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
