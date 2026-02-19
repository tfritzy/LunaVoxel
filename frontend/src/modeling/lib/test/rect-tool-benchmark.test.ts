import { describe, it, expect } from "vitest";
import { isInsideFillShape } from "../fill-shape-utils";
import type { FillShape } from "../tool-type";
import { CHUNK_SIZE } from "@/state/constants";

function buildFrameIntoBuffer(
  buffer: Uint8Array,
  dimY: number,
  dimZ: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  fillShape: FillShape,
  previewValue: number
): void {
  if (fillShape === "Rect") {
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          buffer[x * dimY * dimZ + y * dimZ + z] = previewValue;
        }
      }
    }
    return;
  }

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (
          isInsideFillShape(fillShape, x, y, z, minX, maxX, minY, maxY, minZ, maxZ)
        ) {
          buffer[x * dimY * dimZ + y * dimZ + z] = previewValue;
        }
      }
    }
  }
}

function simulateUpdatePreview(
  buffer: Uint8Array,
  dimX: number,
  dimY: number,
  dimZ: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number
): void {
  const worldYZ = dimY * dimZ;
  const worldZ = dimZ;

  const minChunkX = Math.floor(minX / CHUNK_SIZE) * CHUNK_SIZE;
  const minChunkY = Math.floor(minY / CHUNK_SIZE) * CHUNK_SIZE;
  const minChunkZ = Math.floor(minZ / CHUNK_SIZE) * CHUNK_SIZE;
  const maxChunkX = Math.floor(maxX / CHUNK_SIZE) * CHUNK_SIZE;
  const maxChunkY = Math.floor(maxY / CHUNK_SIZE) * CHUNK_SIZE;
  const maxChunkZ = Math.floor(maxZ / CHUNK_SIZE) * CHUNK_SIZE;

  for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += CHUNK_SIZE) {
    for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += CHUNK_SIZE) {
      for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += CHUNK_SIZE) {
        const sizeX = Math.min(CHUNK_SIZE, dimX - chunkX);
        const sizeY = Math.min(CHUNK_SIZE, dimY - chunkY);
        const sizeZ = Math.min(CHUNK_SIZE, dimZ - chunkZ);

        const blocks = new Uint8Array(sizeX * sizeY * sizeZ);
        for (let lx = 0; lx < sizeX; lx++) {
          const srcXOff = (chunkX + lx) * worldYZ;
          const dstXOff = lx * sizeY * sizeZ;
          for (let ly = 0; ly < sizeY; ly++) {
            const srcXYOff = srcXOff + (chunkY + ly) * worldZ;
            const dstXYOff = dstXOff + ly * sizeZ;
            for (let lz = 0; lz < sizeZ; lz++) {
              const pv = buffer[srcXYOff + chunkZ + lz];
              if (pv !== 0) {
                blocks[dstXYOff + lz] = pv;
              }
            }
          }
        }
      }
    }
  }
}

describe("Rect Tool Benchmark", () => {
  it("should benchmark full rect drag from corner to corner on 64x64x64", () => {
    const size = 64;
    const iterations = 5;
    const times: number[] = [];

    for (let iter = 0; iter < iterations; iter++) {
      const buffer = new Uint8Array(size * size * size);

      const start = performance.now();

      buildFrameIntoBuffer(buffer, size, size, 0, 0, 0, size - 1, size - 1, size - 1, "Rect", 1);
      simulateUpdatePreview(buffer, size, size, size, 0, 0, 0, size - 1, size - 1, size - 1);

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
    const iterations = 3;
    const times: number[] = [];

    for (let iter = 0; iter < iterations; iter++) {
      const buffer = new Uint8Array(sizeX * sizeY * sizeZ);

      const start = performance.now();

      buildFrameIntoBuffer(buffer, sizeY, sizeZ, 0, 0, 0, sizeX - 1, sizeY - 1, sizeZ - 1, "Rect", 1);
      simulateUpdatePreview(buffer, sizeX, sizeY, sizeZ, 0, 0, 0, sizeX - 1, sizeY - 1, sizeZ - 1);

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
