import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getStorage } from "firebase-admin/storage";
import { adminApp } from ".";
import { createCanvas, loadImage } from "canvas";
import type { CanvasRenderingContext2D } from "canvas";
import { callSpacetimeDB } from "./spacetime-client";

interface AddToAtlasRequest {
  projectId: string;
  texture: string;
  targetCellPixelSize: number;
  currentGridSize: number;
  currentUsedSlots: number;
}

interface UpdateAtlasIndexRequest {
  projectId: string;
  index: number;
  texture: string;
  targetCellPixelSize: number;
  currentGridSize: number;
  currentUsedSlots: number;
}

interface DeleteAtlasIndexRequest {
  projectId: string;
  index: number;
  targetCellPixelSize: number;
  currentGridSize: number;
  currentUsedSlots: number;
}

interface AddToAtlasResponse {
  index: number;
}

const getNextPowerOfTwo = (n: number): number => {
  if (n <= 0) return 1;
  if (n <= 1) return 1;
  return Math.pow(2, Math.ceil(Math.log2(n)));
};

const callSpacetimeUpdateAtlas = async (
  projectId: string,
  newGridSize: number,
  newCellPixelWidth: number,
  newUsedSlots: number
): Promise<void> => {
  const response = await callSpacetimeDB(
    "/v1/database/lunavoxel/call/UpdateAtlas",
    "POST",
    [projectId, newGridSize, newCellPixelWidth, newUsedSlots]
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("SpacetimeDB update atlas failed:", errorText);
    throw new Error(`SpacetimeDB error: ${response.status} ${errorText}`);
  }
};

const callSpacetimeDeleteAtlasIndex = async (
  projectId: string,
  index: number,
  newGridSize: number,
  actualCellPixelWidth: number,
  newUsedSlots: number
): Promise<void> => {
  const response = await callSpacetimeDB(
    "/v1/database/lunavoxel/call/DeleteAtlasIndex",
    "POST",
    [projectId, index, newGridSize, actualCellPixelWidth, newUsedSlots]
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("SpacetimeDB update atlas failed:", errorText);
    throw new Error(`SpacetimeDB error: ${response.status} ${errorText}`);
  }
};

const getAtlasInfo = async (projectId: string, currentGridSize: number) => {
  const bucket = getStorage(adminApp).bucket();
  const atlasFile = bucket.file(`atlases/${projectId}.png`);
  let existingAtlas: Buffer | null = null;
  let currentCellPixelWidth = 1;

  const [exists] = await atlasFile.exists();
  if (exists) {
    const [buffer] = await atlasFile.download();
    existingAtlas = buffer;
    const image = (await loadImage(buffer)) as any;

    if (image.width === image.height && image.width > 0) {
      currentCellPixelWidth = image.width / currentGridSize;
    }
  }

  return { existingAtlas, currentCellPixelWidth, atlasFile };
};

const createAtlasCanvas = async (
  existingAtlas: Buffer | null,
  currentGridSize: number,
  currentCellPixelWidth: number,
  requiredSlots: number,
  newCellPixelWidth: number
) => {
  const newGridSize = getNextPowerOfTwo(Math.ceil(Math.sqrt(requiredSlots)));
  const newDimensions = newGridSize * newCellPixelWidth;
  const canvas = createCanvas(newDimensions, newDimensions);
  const ctx = canvas.getContext("2d");

  if (existingAtlas) {
    const existingImage = (await loadImage(existingAtlas)) as any;
    const currentSlots = currentGridSize * currentGridSize;

    if (currentCellPixelWidth === 1 && newCellPixelWidth > 1) {
      const tempCanvas = createCanvas(1, 1);
      const tempCtx = tempCanvas.getContext("2d");

      for (let i = 0; i < currentSlots; i++) {
        const oldCol = i % currentGridSize;
        const oldRow = Math.floor(i / currentGridSize);
        const oldX = oldCol;
        const oldY = oldRow;

        const newCol = i % newGridSize;
        const newRow = Math.floor(i / newGridSize);
        const newX = newCol * newCellPixelWidth;
        const newY = newRow * newCellPixelWidth;

        tempCtx.drawImage(existingImage, oldX, oldY, 1, 1, 0, 0, 1, 1);
        const pixelData = tempCtx.getImageData(0, 0, 1, 1);

        ctx.fillStyle = `rgba(${pixelData.data[0]}, ${pixelData.data[1]}, ${
          pixelData.data[2]
        }, ${pixelData.data[3] / 255})`;
        ctx.fillRect(newX, newY, newCellPixelWidth, newCellPixelWidth);
      }
    } else if (
      currentCellPixelWidth === newCellPixelWidth &&
      currentGridSize !== newGridSize
    ) {
      for (let i = 0; i < currentSlots; i++) {
        const oldCol = i % currentGridSize;
        const oldRow = Math.floor(i / currentGridSize);
        const oldX = oldCol * currentCellPixelWidth;
        const oldY = oldRow * currentCellPixelWidth;

        const newCol = i % newGridSize;
        const newRow = Math.floor(i / newGridSize);
        const newX = newCol * newCellPixelWidth;
        const newY = newRow * newCellPixelWidth;

        ctx.drawImage(
          existingImage,
          oldX,
          oldY,
          currentCellPixelWidth,
          currentCellPixelWidth,
          newX,
          newY,
          newCellPixelWidth,
          newCellPixelWidth
        );
      }
    } else if (currentCellPixelWidth === newCellPixelWidth) {
      ctx.drawImage(existingImage, 0, 0);
    } else {
      throw new HttpsError(
        "failed-precondition",
        "Cannot resize atlas with different cell sizes except from 1x1 to larger sizes. Current size: " +
          currentCellPixelWidth +
          ", New size: " +
          newCellPixelWidth
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
  cellPixelWidth: number
) => {
  const textureImage = (await loadImage(Buffer.from(texture, "base64"))) as any;
  const col = index % gridSize;
  const row = Math.floor(index / gridSize);
  const x = col * cellPixelWidth;
  const y = row * cellPixelWidth;

  ctx.drawImage(textureImage, x, y, cellPixelWidth, cellPixelWidth);
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

export const addToAtlas = onCall<
  AddToAtlasRequest,
  Promise<AddToAtlasResponse>
>(async (request) => {
  const {
    projectId,
    texture,
    currentGridSize,
    currentUsedSlots,
    targetCellPixelSize,
  } = request.data;

  const { existingAtlas, atlasFile, currentCellPixelWidth } =
    await getAtlasInfo(projectId, currentGridSize);

  if (
    currentCellPixelWidth !== 1 &&
    targetCellPixelSize !== currentCellPixelWidth
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Cannot change cell size except from 1x1 to larger sizes"
    );
  }

  const nextIndex = currentUsedSlots;
  const requiredSlots = nextIndex + 1;
  const actualCellPixelWidth =
    currentCellPixelWidth === 1 ? targetCellPixelSize : currentCellPixelWidth;

  const { canvas, ctx, newGridSize } = await createAtlasCanvas(
    existingAtlas,
    currentGridSize,
    currentCellPixelWidth,
    requiredSlots,
    actualCellPixelWidth
  );

  if (texture) {
    await addTextureToCanvas(
      ctx,
      texture,
      nextIndex,
      newGridSize,
      actualCellPixelWidth
    );
  }

  await saveAtlasToStorage(atlasFile, canvas);

  await callSpacetimeUpdateAtlas(
    projectId,
    newGridSize,
    actualCellPixelWidth,
    requiredSlots
  );

  return { index: nextIndex };
});

export const updateAtlasIndex = onCall<UpdateAtlasIndexRequest, Promise<void>>(
  async (request) => {
    const {
      projectId,
      index,
      texture,
      targetCellPixelSize,
      currentGridSize,
      currentUsedSlots,
    } = request.data;

    const { existingAtlas, currentCellPixelWidth, atlasFile } =
      await getAtlasInfo(projectId, currentGridSize);

    if (
      currentCellPixelWidth !== 1 &&
      targetCellPixelSize !== currentCellPixelWidth
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Cannot change cell size except from 1x1 to larger sizes"
      );
    }

    const requiredSlots = Math.max(currentUsedSlots, index + 1);
    const actualCellPixelWidth =
      currentCellPixelWidth === 1 ? targetCellPixelSize : currentCellPixelWidth;

    const { canvas, ctx, newGridSize } = await createAtlasCanvas(
      existingAtlas,
      currentGridSize,
      currentCellPixelWidth,
      requiredSlots,
      actualCellPixelWidth
    );

    if (texture) {
      await addTextureToCanvas(
        ctx,
        texture,
        index,
        newGridSize,
        actualCellPixelWidth
      );
    }

    await saveAtlasToStorage(atlasFile, canvas);

    await callSpacetimeUpdateAtlas(
      projectId,
      newGridSize,
      actualCellPixelWidth,
      requiredSlots
    );
  }
);

export const deleteAtlasIndex = onCall<DeleteAtlasIndexRequest, Promise<void>>(
  async (request) => {
    const {
      projectId,
      index,
      targetCellPixelSize,
      currentGridSize,
      currentUsedSlots,
    } = request.data;

    const { existingAtlas, currentCellPixelWidth, atlasFile } =
      await getAtlasInfo(projectId, currentGridSize);

    if (!existingAtlas) {
      throw new HttpsError(
        "failed-precondition",
        "No atlas exists to delete from"
      );
    }

    if (index >= currentUsedSlots || index < 0) {
      throw new HttpsError("invalid-argument", "Index out of bounds");
    }

    if (
      currentCellPixelWidth !== targetCellPixelSize &&
      !(currentCellPixelWidth > 1 && targetCellPixelSize === 1)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Cannot change cell size except from larger sizes back to 1x1"
      );
    }

    const newUsedSlots = currentUsedSlots - 1;
    const actualCellPixelWidth = targetCellPixelSize;

    if (newUsedSlots === 0) {
      const canvas = createCanvas(0, 0);
      await saveAtlasToStorage(atlasFile, canvas);
      await callSpacetimeUpdateAtlas(projectId, 0, actualCellPixelWidth, 0);
      return;
    }

    const { canvas, ctx, newGridSize } = await createAtlasCanvas(
      null,
      0,
      actualCellPixelWidth,
      newUsedSlots,
      actualCellPixelWidth
    );

    const existingImage = (await loadImage(existingAtlas)) as any;

    if (currentCellPixelWidth > 1 && actualCellPixelWidth === 1) {
      const tempCanvas = createCanvas(1, 1);
      const tempCtx = tempCanvas.getContext("2d");

      for (let i = 0; i < currentUsedSlots; i++) {
        if (i === index) {
          continue;
        }

        const sourceCol = i % currentGridSize;
        const sourceRow = Math.floor(i / currentGridSize);
        const sourceX = sourceCol * currentCellPixelWidth;
        const sourceY = sourceRow * currentCellPixelWidth;

        tempCtx.drawImage(
          existingImage,
          sourceX,
          sourceY,
          currentCellPixelWidth,
          currentCellPixelWidth,
          0,
          0,
          1,
          1
        );
        const pixelData = tempCtx.getImageData(0, 0, 1, 1);

        const destIndex = i > index ? i - 1 : i;
        const destCol = destIndex % newGridSize;
        const destRow = Math.floor(destIndex / newGridSize);
        const destX = destCol * actualCellPixelWidth;
        const destY = destRow * actualCellPixelWidth;

        ctx.fillStyle = `rgba(${pixelData.data[0]}, ${pixelData.data[1]}, ${
          pixelData.data[2]
        }, ${pixelData.data[3] / 255})`;
        ctx.fillRect(destX, destY, actualCellPixelWidth, actualCellPixelWidth);
      }
    } else {
      for (let i = 0; i < currentUsedSlots; i++) {
        if (i === index) {
          continue;
        }

        const sourceCol = i % currentGridSize;
        const sourceRow = Math.floor(i / currentGridSize);
        const sourceX = sourceCol * currentCellPixelWidth;
        const sourceY = sourceRow * currentCellPixelWidth;

        const destIndex = i > index ? i - 1 : i;
        const destCol = destIndex % newGridSize;
        const destRow = Math.floor(destIndex / newGridSize);
        const destX = destCol * actualCellPixelWidth;
        const destY = destRow * actualCellPixelWidth;

        ctx.drawImage(
          existingImage,
          sourceX,
          sourceY,
          currentCellPixelWidth,
          currentCellPixelWidth,
          destX,
          destY,
          actualCellPixelWidth,
          actualCellPixelWidth
        );
      }
    }

    await callSpacetimeDeleteAtlasIndex(
      projectId,
      index,
      newGridSize,
      actualCellPixelWidth,
      newUsedSlots
    );
    await saveAtlasToStorage(atlasFile, canvas);
  }
);
