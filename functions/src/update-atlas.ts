import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getStorage } from "firebase-admin/storage";
import { adminApp, spacetimeUrl } from ".";
import { createCanvas, loadImage } from "canvas";
import type { CanvasRenderingContext2D } from "canvas";

interface AddToAtlasRequest {
  projectId: string;
  texture: string;
  cellSize: number;
  atlasSize: number;
}

interface UpdateAtlasIndexRequest {
  projectId: string;
  index: number;
  texture: string;
  cellSize: number;
  atlasSize: number;
}

interface DeleteAtlasIndexRequest {
  projectId: string;
  index: number;
  cellSize: number;
  atlasSize: number;
}

interface AtlasResponse {
  error?: string;
  index?: number;
}

const callSpacetimeUpdateAtlas = async (
  projectId: string,
  newSize: number,
  cellSize: number
): Promise<void> => {
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
      body: JSON.stringify([projectId, newSize, cellSize]),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("SpacetimeDB update atlas failed:", errorText);
    throw new Error(`SpacetimeDB error: ${response.status} ${errorText}`);
  }
};

const getAtlasInfo = async (projectId: string, atlasSize: number) => {
  const bucket = getStorage(adminApp).bucket();
  const atlasFile = bucket.file(`atlases/${projectId}.png`);
  let existingAtlas: Buffer | null = null;
  let currentGridSize = 0;
  let currentCellSize = 1;

  const [exists] = await atlasFile.exists();
  if (exists) {
    const [buffer] = await atlasFile.download();
    existingAtlas = buffer;
    const image = (await loadImage(buffer)) as any;

    if (image.width === image.height && image.width > 0) {
      const actualGridSize = Math.ceil(Math.sqrt(atlasSize));
      currentCellSize = image.width / actualGridSize;
      currentGridSize = actualGridSize;
    }
  }

  return { existingAtlas, currentGridSize, currentCellSize, atlasFile };
};

const createAtlasCanvas = async (
  existingAtlas: Buffer | null,
  currentGridSize: number,
  currentCellSize: number,
  requiredSlots: number,
  newCellSize: number
) => {
  const newGridSize = Math.ceil(Math.sqrt(requiredSlots));
  const newDimensions = newGridSize * newCellSize;
  const canvas = createCanvas(newDimensions, newDimensions);
  const ctx = canvas.getContext("2d");

  if (existingAtlas) {
    const existingImage = (await loadImage(existingAtlas)) as any;
    const currentSlots = currentGridSize * currentGridSize;

    if (currentCellSize === 1 && newCellSize > 1) {
      const tempCanvas = createCanvas(1, 1);
      const tempCtx = tempCanvas.getContext("2d");

      for (let i = 0; i < currentSlots; i++) {
        const oldCol = i % currentGridSize;
        const oldRow = Math.floor(i / currentGridSize);
        const oldX = oldCol;
        const oldY = oldRow;

        const newCol = i % newGridSize;
        const newRow = Math.floor(i / newGridSize);
        const newX = newCol * newCellSize;
        const newY = newRow * newCellSize;

        tempCtx.drawImage(existingImage, oldX, oldY, 1, 1, 0, 0, 1, 1);
        const pixelData = tempCtx.getImageData(0, 0, 1, 1);

        ctx.fillStyle = `rgba(${pixelData.data[0]}, ${pixelData.data[1]}, ${
          pixelData.data[2]
        }, ${pixelData.data[3] / 255})`;
        ctx.fillRect(newX, newY, newCellSize, newCellSize);
      }
    } else if (
      currentCellSize === newCellSize &&
      currentGridSize !== newGridSize
    ) {
      for (let i = 0; i < currentSlots; i++) {
        const oldCol = i % currentGridSize;
        const oldRow = Math.floor(i / currentGridSize);
        const oldX = oldCol * currentCellSize;
        const oldY = oldRow * currentCellSize;

        const newCol = i % newGridSize;
        const newRow = Math.floor(i / newGridSize);
        const newX = newCol * newCellSize;
        const newY = newRow * newCellSize;

        ctx.drawImage(
          existingImage,
          oldX,
          oldY,
          currentCellSize,
          currentCellSize,
          newX,
          newY,
          newCellSize,
          newCellSize
        );
      }
    } else if (currentCellSize === newCellSize) {
      ctx.drawImage(existingImage, 0, 0);
    } else {
      throw new Error(
        "Cannot resize atlas with different cell sizes except from 1x1 to larger sizes. Current size: " +
          currentCellSize +
          ", New size: " +
          newCellSize
      );
    }
  }

  return { canvas, ctx, newGridSize };
};

const addTextureToCanvas = async (
  ctx: CanvasRenderingContext2D,
  texture: string,
  index: number,
  gridSize: number,
  cellSize: number
) => {
  const textureImage = (await loadImage(Buffer.from(texture, "base64"))) as any;
  const col = index % gridSize;
  const row = Math.floor(index / gridSize);
  const x = col * cellSize;
  const y = row * cellSize;

  ctx.drawImage(textureImage, x, y, cellSize, cellSize);
};

const saveAtlasToStorage = async (
  atlasFile: any,
  canvas: any
): Promise<void> => {
  const buffer = canvas.toBuffer("image/png");
  await atlasFile.save(buffer, {
    metadata: {
      contentType: "image/png",
    },
  });
};

export const addToAtlas = onCall<AddToAtlasRequest, Promise<AtlasResponse>>(
  async (request) => {
    const { projectId, texture, cellSize, atlasSize } = request.data;

    const { existingAtlas, currentGridSize, currentCellSize, atlasFile } =
      await getAtlasInfo(projectId, atlasSize);

    if (currentCellSize !== 1 && currentCellSize !== cellSize) {
      throw new Error(
        "Cannot change cell size except from 1x1 to larger sizes"
      );
    }

    const nextIndex = atlasSize;
    const requiredSlots = nextIndex + 1;
    const actualCellSize = currentCellSize === 1 ? cellSize : currentCellSize;

    const { canvas, ctx, newGridSize } = await createAtlasCanvas(
      existingAtlas,
      currentGridSize,
      currentCellSize,
      requiredSlots,
      actualCellSize
    );

    if (texture) {
      await addTextureToCanvas(
        ctx,
        texture,
        nextIndex,
        newGridSize,
        actualCellSize
      );
    }

    await saveAtlasToStorage(atlasFile, canvas);

    await callSpacetimeUpdateAtlas(projectId, requiredSlots, actualCellSize);

    return { error: undefined, index: nextIndex };
  }
);

export const updateAtlasIndex = onCall<
  UpdateAtlasIndexRequest,
  Promise<AtlasResponse>
>(async (request) => {
  const { projectId, index, texture, cellSize, atlasSize } = request.data;

  const { existingAtlas, currentGridSize, currentCellSize, atlasFile } =
    await getAtlasInfo(projectId, atlasSize);

  if (currentCellSize !== 1 && currentCellSize !== cellSize) {
    throw new Error("Cannot change cell size except from 1x1 to larger sizes");
  }

  const currentSlots = atlasSize;
  const requiredSlots = Math.max(currentSlots, index + 1);
  const actualCellSize = currentCellSize === 1 ? cellSize : currentCellSize;

  const { canvas, ctx, newGridSize } = await createAtlasCanvas(
    existingAtlas,
    currentGridSize,
    currentCellSize,
    requiredSlots,
    actualCellSize
  );

  if (texture) {
    await addTextureToCanvas(ctx, texture, index, newGridSize, actualCellSize);
  }

  await saveAtlasToStorage(atlasFile, canvas);

  await callSpacetimeUpdateAtlas(projectId, requiredSlots, actualCellSize);

  return { error: undefined };
});

export const deleteAtlasIndex = onCall<
  DeleteAtlasIndexRequest,
  Promise<AtlasResponse>
>(async (request) => {
  const { projectId, index, cellSize, atlasSize } = request.data;

  const { existingAtlas, currentGridSize, currentCellSize, atlasFile } =
    await getAtlasInfo(projectId, atlasSize);

  if (!existingAtlas) {
    throw new Error("No atlas exists to delete from");
  }

  if (index >= atlasSize || index < 0) {
    throw new Error("Index out of bounds");
  }

  if (
    currentCellSize !== cellSize &&
    !(currentCellSize > 1 && cellSize === 1)
  ) {
    throw new Error(
      "Cannot change cell size except from larger sizes back to 1x1"
    );
  }

  const newAtlasSize = atlasSize - 1;
  const actualCellSize = cellSize;

  if (newAtlasSize === 0) {
    const canvas = createCanvas(0, 0);
    await saveAtlasToStorage(atlasFile, canvas);
    await callSpacetimeUpdateAtlas(projectId, 0, actualCellSize);
    return { error: undefined };
  }

  const { canvas, ctx, newGridSize } = await createAtlasCanvas(
    null,
    0,
    actualCellSize,
    newAtlasSize,
    actualCellSize
  );

  const existingImage = (await loadImage(existingAtlas)) as any;

  if (currentCellSize > 1 && actualCellSize === 1) {
    const tempCanvas = createCanvas(1, 1);
    const tempCtx = tempCanvas.getContext("2d");

    for (let i = 0; i < atlasSize; i++) {
      if (i === index) {
        continue;
      }

      const sourceCol = i % currentGridSize;
      const sourceRow = Math.floor(i / currentGridSize);
      const sourceX = sourceCol * currentCellSize;
      const sourceY = sourceRow * currentCellSize;

      tempCtx.drawImage(
        existingImage,
        sourceX,
        sourceY,
        currentCellSize,
        currentCellSize,
        0,
        0,
        1,
        1
      );
      const pixelData = tempCtx.getImageData(0, 0, 1, 1);

      const destIndex = i > index ? i - 1 : i;
      const destCol = destIndex % newGridSize;
      const destRow = Math.floor(destIndex / newGridSize);
      const destX = destCol * actualCellSize;
      const destY = destRow * actualCellSize;

      ctx.fillStyle = `rgba(${pixelData.data[0]}, ${pixelData.data[1]}, ${
        pixelData.data[2]
      }, ${pixelData.data[3] / 255})`;
      ctx.fillRect(destX, destY, actualCellSize, actualCellSize);
    }
  } else {
    for (let i = 0; i < atlasSize; i++) {
      if (i === index) {
        continue;
      }

      const sourceCol = i % currentGridSize;
      const sourceRow = Math.floor(i / currentGridSize);
      const sourceX = sourceCol * currentCellSize;
      const sourceY = sourceRow * currentCellSize;

      const destIndex = i > index ? i - 1 : i;
      const destCol = destIndex % newGridSize;
      const destRow = Math.floor(destIndex / newGridSize);
      const destX = destCol * actualCellSize;
      const destY = destRow * actualCellSize;

      ctx.drawImage(
        existingImage,
        sourceX,
        sourceY,
        currentCellSize,
        currentCellSize,
        destX,
        destY,
        actualCellSize,
        actualCellSize
      );
    }
  }

  await callSpacetimeUpdateAtlas(projectId, newAtlasSize, actualCellSize);
  await saveAtlasToStorage(atlasFile, canvas);

  return { error: undefined };
});
