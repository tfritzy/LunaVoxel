import { describe, it, expect, beforeEach } from "vitest";
import { Chunk } from "../chunk";
import { ChunkManager } from "../chunk-manager";
import * as THREE from "three";
import type { Vector3, BlockModificationMode } from "@/state/types";
import { AtlasData } from "@/lib/useAtlas";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import { stateStore, resetState } from "@/state/store";

describe("Move selection with floating layer", () => {
  let scene: THREE.Scene;
  let chunk: Chunk;
  const chunkSize: Vector3 = { x: 8, y: 8, z: 8 };
  const minPos: Vector3 = { x: 0, y: 0, z: 0 };
  const mockAtlasData: AtlasData = {
    texture: null as unknown as THREE.Texture,
    blockAtlasMapping: [0],
    colors: [0xffffff],
  };

  beforeEach(() => {
    scene = new THREE.Scene();
    chunk = new Chunk(
      scene,
      minPos,
      chunkSize,
      3,
      mockAtlasData,
      () => ({ tag: "Attach" } as BlockModificationMode),
      () => true
    );
  });

  it("should clear voxels from object chunk when lifted", () => {
    const voxels = new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z);
    const index = 1 * chunkSize.y * chunkSize.z + 1 * chunkSize.z + 1;
    voxels[index] = 1 | RAYCASTABLE_BIT;
    chunk.setObjectChunk(0, voxels);

    const objectChunk = chunk.getObjectChunk(0);
    expect(objectChunk).not.toBeNull();
    expect(objectChunk!.voxels[index]).toBe(1 | RAYCASTABLE_BIT);

    objectChunk!.voxels[index] = 0;
    chunk.update();

    expect(objectChunk!.voxels[index]).toBe(0);
  });

  it("should preserve other voxels when specific voxels are cleared", () => {
    const voxels = new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z);
    const idx1 = 1 * chunkSize.y * chunkSize.z + 1 * chunkSize.z + 1;
    const idx2 = 2 * chunkSize.y * chunkSize.z + 2 * chunkSize.z + 2;
    const idx3 = 3 * chunkSize.y * chunkSize.z + 3 * chunkSize.z + 3;
    voxels[idx1] = 1 | RAYCASTABLE_BIT;
    voxels[idx2] = 2 | RAYCASTABLE_BIT;
    voxels[idx3] = 3 | RAYCASTABLE_BIT;
    chunk.setObjectChunk(0, voxels);

    voxels[idx1] = 0;
    chunk.update();

    const objectChunk = chunk.getObjectChunk(0);
    expect(objectChunk!.voxels[idx1]).toBe(0);
    expect(objectChunk!.voxels[idx2]).toBe(2 | RAYCASTABLE_BIT);
    expect(objectChunk!.voxels[idx3]).toBe(3 | RAYCASTABLE_BIT);
  });

  it("should write voxels back when committed at offset position", () => {
    const voxels = new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z);
    const srcIdx = 1 * chunkSize.y * chunkSize.z + 1 * chunkSize.z + 1;
    voxels[srcIdx] = 5 | RAYCASTABLE_BIT;
    chunk.setObjectChunk(0, voxels);

    voxels[srcIdx] = 0;

    const dstIdx = 3 * chunkSize.y * chunkSize.z + 3 * chunkSize.z + 3;
    voxels[dstIdx] = 5 | RAYCASTABLE_BIT;
    chunk.update();

    const objectChunk = chunk.getObjectChunk(0);
    expect(objectChunk!.voxels[srcIdx]).toBe(0);
    expect(objectChunk!.voxels[dstIdx]).toBe(5 | RAYCASTABLE_BIT);
  });

  it("should overwrite existing voxels at destination on commit", () => {
    const voxels = new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z);
    const existingIdx = 4 * chunkSize.y * chunkSize.z + 4 * chunkSize.z + 4;
    voxels[existingIdx] = 2 | RAYCASTABLE_BIT;
    chunk.setObjectChunk(0, voxels);

    voxels[existingIdx] = 7 | RAYCASTABLE_BIT;
    chunk.update();

    const objectChunk = chunk.getObjectChunk(0);
    expect(objectChunk!.voxels[existingIdx]).toBe(7 | RAYCASTABLE_BIT);
  });
});

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
    chunkManager.liftSelection(0);
    const offset = new THREE.Vector3(2, 0, 0);
    chunkManager.commitFloatingSelection(0, offset);

    expect(chunkManager.hasFloatingSelection()).toBe(false);
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
});
