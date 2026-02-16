import { describe, it, expect } from "vitest";
import { VoxelFrame } from "../voxel-frame";
import { isInsideFillShape } from "../fill-shape-utils";
import type { FillShape } from "../tool-type";

function buildFrameFromBounds(
  previewFrame: VoxelFrame,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  fillShape: FillShape,
  previewValue: number
): void {
  const frameSize = {
    x: maxX - minX + 1,
    y: maxY - minY + 1,
    z: maxZ - minZ + 1,
  };
  const frameMinPos = { x: minX, y: minY, z: minZ };

  previewFrame.clear();
  previewFrame.resize(frameSize, frameMinPos);

  if (fillShape === "Rect") {
    previewFrame.fill(previewValue);
    return;
  }

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (
          isInsideFillShape(
            fillShape,
            x,
            y,
            z,
            minX,
            maxX,
            minY,
            maxY,
            minZ,
            maxZ
          )
        ) {
          previewFrame.set(x, y, z, previewValue);
        }
      }
    }
  }
}

function simulateSetPreview(
  previewFrame: VoxelFrame,
  chunkSize: number,
  dimensionsX: number,
  dimensionsY: number,
  dimensionsZ: number
): void {
  const frameMinPos = previewFrame.getMinPos();
  const frameMaxPos = previewFrame.getMaxPos();

  const minChunkX =
    Math.floor(frameMinPos.x / chunkSize) * chunkSize;
  const minChunkY =
    Math.floor(frameMinPos.y / chunkSize) * chunkSize;
  const minChunkZ =
    Math.floor(frameMinPos.z / chunkSize) * chunkSize;
  const maxChunkX =
    Math.floor((frameMaxPos.x - 1) / chunkSize) * chunkSize;
  const maxChunkY =
    Math.floor((frameMaxPos.y - 1) / chunkSize) * chunkSize;
  const maxChunkZ =
    Math.floor((frameMaxPos.z - 1) / chunkSize) * chunkSize;

  for (
    let chunkX = minChunkX;
    chunkX <= maxChunkX;
    chunkX += chunkSize
  ) {
    for (
      let chunkY = minChunkY;
      chunkY <= maxChunkY;
      chunkY += chunkSize
    ) {
      for (
        let chunkZ = minChunkZ;
        chunkZ <= maxChunkZ;
        chunkZ += chunkSize
      ) {
        const sizeX = Math.min(chunkSize, dimensionsX - chunkX);
        const sizeY = Math.min(chunkSize, dimensionsY - chunkY);
        const sizeZ = Math.min(chunkSize, dimensionsZ - chunkZ);
        const chunkPreview = new VoxelFrame(
          { x: sizeX, y: sizeY, z: sizeZ }
        );

        const copyMinX = Math.max(chunkX, frameMinPos.x);
        const copyMinY = Math.max(chunkY, frameMinPos.y);
        const copyMinZ = Math.max(chunkZ, frameMinPos.z);
        const copyMaxX = Math.min(chunkX + sizeX, frameMaxPos.x);
        const copyMaxY = Math.min(chunkY + sizeY, frameMaxPos.y);
        const copyMaxZ = Math.min(chunkZ + sizeZ, frameMaxPos.z);

        for (let worldX = copyMinX; worldX < copyMaxX; worldX++) {
          for (let worldY = copyMinY; worldY < copyMaxY; worldY++) {
            for (
              let worldZ = copyMinZ;
              worldZ < copyMaxZ;
              worldZ++
            ) {
              const blockValue = previewFrame.get(
                worldX,
                worldY,
                worldZ
              );
              if (blockValue !== 0) {
                const localX = worldX - chunkX;
                const localY = worldY - chunkY;
                const localZ = worldZ - chunkZ;
                const index = localX * sizeY * sizeZ + localY * sizeZ + localZ;
                chunkPreview.setByIndex(index, blockValue);
              }
            }
          }
        }

        simulateMergePreview(chunkPreview, sizeX, sizeY, sizeZ);
      }
    }
  }
}

function simulateMergePreview(
  previewFrame: VoxelFrame,
  sizeX: number,
  sizeY: number,
  sizeZ: number
): void {
  if (previewFrame.isEmpty()) return;

  const blocks = new Uint8Array(sizeX * sizeY * sizeZ);
  const previewData = previewFrame.getData();
  const len = Math.min(blocks.length, previewData.length);

  for (let i = 0; i < len; i++) {
    const pv = previewData[i];
    if (pv !== 0) {
      blocks[i] = pv;
    }
  }
}

describe("Rect Tool Benchmark", () => {
  it("should benchmark full rect drag from corner to corner on 64x64x64", () => {
    const size = 64;
    const chunkSize = 32;
    const iterations = 5;
    const times: number[] = [];

    for (let iter = 0; iter < iterations; iter++) {
      const previewFrame = new VoxelFrame(
        { x: size, y: size, z: size }
      );

      const start = performance.now();

      buildFrameFromBounds(
        previewFrame,
        0,
        0,
        0,
        size - 1,
        size - 1,
        size - 1,
        "Rect",
        1
      );

      simulateSetPreview(previewFrame, chunkSize, size, size, size);

      const elapsed = performance.now() - start;
      times.push(elapsed);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    console.log(`Rect drag 64x64x64 (full pipeline):`);
    console.log(`  Average: ${avg.toFixed(2)}ms`);
    console.log(`  Min: ${min.toFixed(2)}ms`);
    console.log(`  Max: ${max.toFixed(2)}ms`);

    expect(avg).toBeLessThan(100);
  });

  it("should benchmark full rect drag from corner to corner on 128x64x128", () => {
    const sizeX = 128;
    const sizeY = 64;
    const sizeZ = 128;
    const chunkSize = 32;
    const iterations = 3;
    const times: number[] = [];

    for (let iter = 0; iter < iterations; iter++) {
      const previewFrame = new VoxelFrame(
        { x: sizeX, y: sizeY, z: sizeZ }
      );

      const start = performance.now();

      buildFrameFromBounds(
        previewFrame,
        0,
        0,
        0,
        sizeX - 1,
        sizeY - 1,
        sizeZ - 1,
        "Rect",
        1
      );

      simulateSetPreview(
        previewFrame,
        chunkSize,
        sizeX,
        sizeY,
        sizeZ
      );

      const elapsed = performance.now() - start;
      times.push(elapsed);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    console.log(`Rect drag 128x64x128 (full pipeline):`);
    console.log(`  Average: ${avg.toFixed(2)}ms`);
    console.log(`  Min: ${min.toFixed(2)}ms`);
    console.log(`  Max: ${max.toFixed(2)}ms`);

    expect(avg).toBeLessThan(500);
  });
});
