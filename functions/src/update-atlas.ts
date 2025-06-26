import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getStorage } from "firebase-admin/storage";
import { adminApp, spacetimeUrl } from ".";
import { createCanvas, loadImage } from "canvas";

interface UpdateAtlasRequest {
  projectId: string;
  index: number;
  texture: string;
  tint: string;
}

interface UpdateAtlasResponse {
  error?: string;
}

export const updateAtlas = onCall<
  UpdateAtlasRequest,
  Promise<UpdateAtlasResponse>
>(async (request) => {
  const { projectId, index, texture, tint } = request.data;

  const bucket = getStorage(adminApp).bucket();
  const atlasFile = bucket.file(`atlases/${projectId}.png`);

  let existingAtlas: Buffer | null = null;
  let currentDimensions = 0;

  const [exists] = await atlasFile.exists();
  if (exists) {
    const [buffer] = await atlasFile.download();
    existingAtlas = buffer;
    const image = await loadImage(buffer);
    currentDimensions = image.width;
  }

  const currentSlots =
    currentDimensions > 0
      ? Math.pow(currentDimensions / Math.sqrt(currentDimensions), 2)
      : 0;
  const requiredSlots = Math.max(currentSlots, index + 1);
  const newGridSize = Math.ceil(Math.sqrt(requiredSlots));
  const cellSize =
    currentDimensions > 0 ? currentDimensions / Math.sqrt(currentSlots) : 64;
  const newDimensions = newGridSize * cellSize;

  const canvas = createCanvas(newDimensions, newDimensions);
  const ctx = canvas.getContext("2d");

  if (existingAtlas) {
    const existingImage = await loadImage(existingAtlas);
    ctx.drawImage(existingImage, 0, 0);
  }

  if (texture) {
    const textureImage = await loadImage(Buffer.from(texture, "base64"));
    const col = index % newGridSize;
    const row = Math.floor(index / newGridSize);
    const x = col * cellSize;
    const y = row * cellSize;

    ctx.drawImage(textureImage, x, y, cellSize, cellSize);
  }

  const buffer = canvas.toBuffer("image/png");
  await atlasFile.save(buffer, {
    metadata: {
      contentType: "image/png",
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const spacetimeHost = spacetimeUrl.value();
  const isDev = spacetimeHost.includes("localhost");
  const protocol = isDev ? "http" : "https";
  const response = await fetch(
    `${protocol}://${spacetimeHost}/v1/database/lunavoxel/call/UpdateAtlas`,
    {
      method: "POST",
      headers,
      body: JSON.stringify([projectId, index, tint, true]),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("SpacetimeDB sync failed:", errorText);
    throw new Error(`SpacetimeDB error: ${response.status} ${errorText}`);
  }

  return { error: undefined };
});
