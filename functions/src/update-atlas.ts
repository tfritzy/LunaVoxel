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
  cellSize: number;
}

interface UpdateAtlasResponse {
  error?: string;
}
export const updateAtlas = onCall<
  UpdateAtlasRequest,
  Promise<UpdateAtlasResponse>
>(async (request) => {
  const { projectId, index, texture, tint, cellSize } = request.data;

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
      body: JSON.stringify([projectId, index, tint, true, cellSize]),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("SpacetimeDB update atlas failed:", errorText);
    throw new Error(`SpacetimeDB error: ${response.status} ${errorText}`);
  }

  const bucket = getStorage(adminApp).bucket();
  const atlasFile = bucket.file(`atlases/${projectId}.png`);

  let existingAtlas: Buffer | null = null;
  let currentGridSize = 0;

  const [exists] = await atlasFile.exists();
  if (exists) {
    const [buffer] = await atlasFile.download();
    existingAtlas = buffer;
    const image = await loadImage(buffer);
    currentGridSize = image.width / cellSize;
  }

  const currentSlots = currentGridSize * currentGridSize;
  const requiredSlots = Math.max(currentSlots, index + 1);
  const newGridSize = Math.ceil(Math.sqrt(requiredSlots));
  const newDimensions = newGridSize * cellSize;

  const canvas = createCanvas(newDimensions, newDimensions);
  const ctx = canvas.getContext("2d");

  if (existingAtlas && currentGridSize !== newGridSize) {
    const existingImage = await loadImage(existingAtlas);

    // Copy each existing cell to its correct position in the new grid
    for (let i = 0; i < currentSlots; i++) {
      const oldCol = i % currentGridSize;
      const oldRow = Math.floor(i / currentGridSize);
      const oldX = oldCol * cellSize;
      const oldY = oldRow * cellSize;

      const newCol = i % newGridSize;
      const newRow = Math.floor(i / newGridSize);
      const newX = newCol * cellSize;
      const newY = newRow * cellSize;

      // Extract the cell from old position and draw to new position
      ctx.drawImage(
        existingImage,
        oldX,
        oldY,
        cellSize,
        cellSize,
        newX,
        newY,
        cellSize,
        cellSize
      );
    }
  } else if (existingAtlas) {
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

  return { error: undefined };
});
