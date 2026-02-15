import { describe, it, expect, beforeEach } from "vitest";
import { ChunkManager } from "../chunk-manager";
import * as THREE from "three";
import type { Vector3, BlockModificationMode } from "@/state/types";
import { stateStore, resetState } from "@/state/store";
import { CHUNK_SIZE } from "@/state/constants";
import type { SelectionData } from "../chunk";

function createSelectionForVoxels(
  chunkSize: Vector3,
  positions: { x: number; y: number; z: number }[]
): SelectionData {
  const voxelData = new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z);
  for (const pos of positions) {
    const index = pos.x * chunkSize.y * chunkSize.z + pos.y * chunkSize.z + pos.z;
    voxelData[index] = 1;
  }
  return {
    object: 0,
    frame: {
      minPos: { x: 0, y: 0, z: 0 },
      dimensions: { ...chunkSize },
      voxelData,
    },
    offset: { x: 0, y: 0, z: 0 },
  };
}

describe("ChunkManager floating selection", () => {
  const dimensions: Vector3 = { x: 64, y: 64, z: 64 };
  const chunkSize: Vector3 = { x: CHUNK_SIZE, y: CHUNK_SIZE, z: CHUNK_SIZE };
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

  it("should lift only selected voxels and clear them from chunk", () => {
    const selectedPositions = [
      { x: 10, y: 0, z: 10 },
      { x: 11, y: 0, z: 10 },
      { x: 12, y: 0, z: 10 },
    ];
    const selectionData = createSelectionForVoxels(chunkSize, selectedPositions);
    chunkManager.setSelectionFrame("local", selectionData);

    chunkManager.liftSelection(0);

    expect(chunkManager.hasFloatingSelection()).toBe(true);

    const chunk = chunkManager.getChunks()[0];
    const objectChunk = chunk?.getObjectChunk(0);
    expect(objectChunk).not.toBeNull();

    for (const pos of selectedPositions) {
      const idx = pos.x * chunkSize.y * chunkSize.z + pos.y * chunkSize.z + pos.z;
      expect(objectChunk!.voxels[idx]).toBe(0);
    }

    const unselectedIdx = 13 * chunkSize.y * chunkSize.z + 0 * chunkSize.z + 10;
    expect(objectChunk!.voxels[unselectedIdx]).not.toBe(0);
  });

  it("should not lift anything if no selection exists", () => {
    chunkManager.liftSelection(0);
    expect(chunkManager.hasFloatingSelection()).toBe(false);
  });

  it("should commit floating selection at offset", () => {
    const selectedPositions = [
      { x: 10, y: 0, z: 10 },
      { x: 11, y: 0, z: 10 },
    ];
    const selectionData = createSelectionForVoxels(chunkSize, selectedPositions);
    chunkManager.setSelectionFrame("local", selectionData);

    const chunk = chunkManager.getChunks()[0];
    const objectChunk = chunk?.getObjectChunk(0);
    const srcIdx0 = 10 * chunkSize.y * chunkSize.z + 0 * chunkSize.z + 10;
    const srcIdx1 = 11 * chunkSize.y * chunkSize.z + 0 * chunkSize.z + 10;
    const origVal0 = objectChunk!.voxels[srcIdx0];
    const origVal1 = objectChunk!.voxels[srcIdx1];

    chunkManager.liftSelection(0);
    chunkManager.commitFloatingSelection(0, new THREE.Vector3(2, 0, 0));

    expect(chunkManager.hasFloatingSelection()).toBe(false);

    const dstIdx0 = 12 * chunkSize.y * chunkSize.z + 0 * chunkSize.z + 10;
    const dstIdx1 = 13 * chunkSize.y * chunkSize.z + 0 * chunkSize.z + 10;
    expect(objectChunk!.voxels[srcIdx0]).toBe(0);
    expect(objectChunk!.voxels[srcIdx1]).toBe(0);
    expect(objectChunk!.voxels[dstIdx0]).toBe(origVal0);
    expect(objectChunk!.voxels[dstIdx1]).toBe(origVal1);
  });

  it("should cancel floating selection and restore original voxels", () => {
    const selectedPositions = [
      { x: 10, y: 0, z: 10 },
      { x: 11, y: 0, z: 10 },
    ];
    const selectionData = createSelectionForVoxels(chunkSize, selectedPositions);
    chunkManager.setSelectionFrame("local", selectionData);

    const chunk = chunkManager.getChunks()[0];
    const objectChunk = chunk?.getObjectChunk(0);
    const origVoxels = new Uint8Array(objectChunk!.voxels);

    chunkManager.liftSelection(0);
    chunkManager.cancelFloatingSelection();

    expect(chunkManager.hasFloatingSelection()).toBe(false);
    expect(objectChunk!.voxels).toEqual(origVoxels);
  });

  it("should not lift if object does not exist", () => {
    const selectionData = createSelectionForVoxels(chunkSize, [{ x: 10, y: 0, z: 10 }]);
    chunkManager.setSelectionFrame("local", selectionData);
    chunkManager.liftSelection(99);
    expect(chunkManager.hasFloatingSelection()).toBe(false);
  });

  it("should overwrite existing voxels when committing at destination", () => {
    const selectedPositions = [{ x: 10, y: 0, z: 10 }];
    const selectionData = createSelectionForVoxels(chunkSize, selectedPositions);
    chunkManager.setSelectionFrame("local", selectionData);

    const chunk = chunkManager.getChunks()[0];
    const objectChunk = chunk?.getObjectChunk(0);

    const srcIdx = 10 * chunkSize.y * chunkSize.z + 0 * chunkSize.z + 10;
    const dstIdx = 12 * chunkSize.y * chunkSize.z + 0 * chunkSize.z + 10;
    const srcVal = objectChunk!.voxels[srcIdx];
    const dstVal = objectChunk!.voxels[dstIdx];

    expect(srcVal & 0x7F).toBeGreaterThan(0);
    expect(dstVal & 0x7F).toBeGreaterThan(0);

    chunkManager.liftSelection(0);
    chunkManager.commitFloatingSelection(0, new THREE.Vector3(2, 0, 0));

    expect(objectChunk!.voxels[srcIdx]).toBe(0);
    expect(objectChunk!.voxels[dstIdx]).toBe(srcVal);
  });

  it("should not clear non-selected voxels while dragging through them", () => {
    const selectedPositions = [
      { x: 10, y: 0, z: 10 },
      { x: 11, y: 0, z: 10 },
    ];
    const selectionData = createSelectionForVoxels(chunkSize, selectedPositions);
    chunkManager.setSelectionFrame("local", selectionData);

    const chunk = chunkManager.getChunks()[0];
    const objectChunk = chunk?.getObjectChunk(0);

    const unselectedIdx = 13 * chunkSize.y * chunkSize.z + 0 * chunkSize.z + 10;
    const unselectedVal = objectChunk!.voxels[unselectedIdx];
    expect(unselectedVal & 0x7F).toBeGreaterThan(0);

    chunkManager.liftSelection(0);
    chunkManager.renderFloatingSelection(new THREE.Vector3(5, 0, 0));
    chunkManager.renderFloatingSelection(new THREE.Vector3(10, 0, 0));
    chunkManager.renderFloatingSelection(new THREE.Vector3(3, 0, 0));

    expect(objectChunk!.voxels[unselectedIdx]).toBe(unselectedVal);

    chunkManager.cancelFloatingSelection();
    expect(chunkManager.hasFloatingSelection()).toBe(false);
  });
});
