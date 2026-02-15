import { describe, it, expect, beforeEach } from "vitest";
import { ChunkManager } from "../chunk-manager";
import * as THREE from "three";
import type { Vector3, BlockModificationMode } from "@/state/types";
import { stateStore, resetState } from "@/state/store";

describe("ChunkManager floating selection", () => {
  const dimensions: Vector3 = { x: 64, y: 64, z: 64 };
  let scene: THREE.Scene;
  let chunkManager: ChunkManager;

  beforeEach(() => {
    resetState();
    scene = new THREE.Scene();
    chunkManager = new ChunkManager(
      scene,
      dimensions,
      stateStore,
      stateStore.getState().project.id,
      () => ({ tag: "Attach" } as BlockModificationMode)
    );
  });

  it("should report no floating selection initially", () => {
    expect(chunkManager.hasFloatingSelection()).toBe(false);
  });

  it("should lift selection and clear original voxels", () => {
    chunkManager.liftSelection(0);

    expect(chunkManager.hasFloatingSelection()).toBe(true);

    for (const chunk of chunkManager.getChunks()) {
      const objectChunk = chunk.getObjectChunk(0);
      if (!objectChunk) continue;
      for (let i = 0; i < objectChunk.voxels.length; i++) {
        expect(objectChunk.voxels[i]).toBe(0);
      }
    }
  });

  it("should commit floating selection at offset", () => {
    const voxelsBefore = new Map<string, number>();
    for (const chunk of chunkManager.getChunks()) {
      const objectChunk = chunk.getObjectChunk(0);
      if (!objectChunk) continue;
      const sizeY = chunk.size.y;
      const sizeZ = chunk.size.z;
      const sizeYZ = sizeY * sizeZ;
      for (let i = 0; i < objectChunk.voxels.length; i++) {
        if (objectChunk.voxels[i] !== 0) {
          const localX = Math.floor(i / sizeYZ);
          const localY = Math.floor((i % sizeYZ) / sizeZ);
          const localZ = i % sizeZ;
          const worldX = chunk.minPos.x + localX;
          const worldY = chunk.minPos.y + localY;
          const worldZ = chunk.minPos.z + localZ;
          voxelsBefore.set(`${worldX},${worldY},${worldZ}`, objectChunk.voxels[i]);
        }
      }
    }

    expect(voxelsBefore.size).toBeGreaterThan(0);

    chunkManager.liftSelection(0);
    const offset = new THREE.Vector3(2, 0, 0);
    chunkManager.commitFloatingSelection(0, offset);

    expect(chunkManager.hasFloatingSelection()).toBe(false);

    const voxelsAfter = new Map<string, number>();
    for (const chunk of chunkManager.getChunks()) {
      const objectChunk = chunk.getObjectChunk(0);
      if (!objectChunk) continue;
      const sizeY = chunk.size.y;
      const sizeZ = chunk.size.z;
      const sizeYZ = sizeY * sizeZ;
      for (let i = 0; i < objectChunk.voxels.length; i++) {
        if (objectChunk.voxels[i] !== 0) {
          const localX = Math.floor(i / sizeYZ);
          const localY = Math.floor((i % sizeYZ) / sizeZ);
          const localZ = i % sizeZ;
          const worldX = chunk.minPos.x + localX;
          const worldY = chunk.minPos.y + localY;
          const worldZ = chunk.minPos.z + localZ;
          voxelsAfter.set(`${worldX},${worldY},${worldZ}`, objectChunk.voxels[i]);
        }
      }
    }

    expect(voxelsAfter.size).toBe(voxelsBefore.size);

    for (const [key, value] of voxelsBefore) {
      const [x, y, z] = key.split(",").map(Number);
      const newKey = `${x + 2},${y},${z}`;
      expect(voxelsAfter.has(newKey)).toBe(true);
      expect(voxelsAfter.get(newKey)).toBe(value);
    }
  });

  it("should cancel floating selection and restore original voxels", () => {
    const originalVoxels = new Map<string, Uint8Array>();
    for (const chunk of chunkManager.getChunks()) {
      const objectChunk = chunk.getObjectChunk(0);
      if (objectChunk) {
        const key = `${chunk.minPos.x},${chunk.minPos.y},${chunk.minPos.z}`;
        originalVoxels.set(key, new Uint8Array(objectChunk.voxels));
      }
    }

    chunkManager.liftSelection(0);
    chunkManager.cancelFloatingSelection();

    expect(chunkManager.hasFloatingSelection()).toBe(false);

    for (const chunk of chunkManager.getChunks()) {
      const objectChunk = chunk.getObjectChunk(0);
      if (objectChunk) {
        const key = `${chunk.minPos.x},${chunk.minPos.y},${chunk.minPos.z}`;
        const original = originalVoxels.get(key);
        if (original) {
          expect(objectChunk.voxels).toEqual(original);
        }
      }
    }
  });

  it("should not lift if object does not exist", () => {
    chunkManager.liftSelection(99);
    expect(chunkManager.hasFloatingSelection()).toBe(false);
  });

  it("should overwrite existing voxels when committing at destination", () => {
    const state = stateStore.getState();
    const obj = state.objects[0];
    const chunkData = Array.from(state.chunks.values()).find(
      c => c.objectId === obj.id
    );
    if (!chunkData) return;

    const sizeY = chunkData.size.y;
    const sizeZ = chunkData.size.z;
    const srcIdx = 10 * sizeY * sizeZ + 0 * sizeZ + 10;
    const dstIdx = 12 * sizeY * sizeZ + 0 * sizeZ + 10;
    const srcVal = chunkData.voxels[srcIdx];
    const dstVal = chunkData.voxels[dstIdx];

    expect(srcVal & 0x7F).toBeGreaterThan(0);
    expect(dstVal & 0x7F).toBeGreaterThan(0);

    chunkManager.liftSelection(0);
    chunkManager.commitFloatingSelection(0, new THREE.Vector3(2, 0, 0));

    const afterChunk = chunkManager.getChunks()[0]?.getObjectChunk(0);
    if (afterChunk) {
      expect(afterChunk.voxels[srcIdx]).toBe(0);
      expect(afterChunk.voxels[dstIdx]).toBe(srcVal);
    }
  });

  it("should not clear other voxels while dragging through them", () => {
    chunkManager.liftSelection(0);
    chunkManager.renderFloatingSelection(new THREE.Vector3(5, 0, 0));
    chunkManager.renderFloatingSelection(new THREE.Vector3(10, 0, 0));
    chunkManager.renderFloatingSelection(new THREE.Vector3(3, 0, 0));

    for (const chunk of chunkManager.getChunks()) {
      const objectChunk = chunk.getObjectChunk(0);
      if (!objectChunk) continue;
      for (let i = 0; i < objectChunk.voxels.length; i++) {
        expect(objectChunk.voxels[i]).toBe(0);
      }
    }

    chunkManager.cancelFloatingSelection();
    expect(chunkManager.hasFloatingSelection()).toBe(false);
  });
});
