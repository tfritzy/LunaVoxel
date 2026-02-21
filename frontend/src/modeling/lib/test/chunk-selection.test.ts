import { describe, it, expect, beforeEach } from "vitest";
import { Chunk } from "../chunk";
import * as THREE from "three";
import type { Vector3, BlockModificationMode } from "@/state/types";
import { AtlasData } from "@/lib/useAtlas";
import { VoxelFrame } from "../voxel-frame";

function createMockTexture(width: number): THREE.Texture {
  const texture = { image: { width } } as unknown as THREE.Texture;
  return texture;
}

describe("Chunk selection rendering", () => {
  let scene: THREE.Scene;
  let chunk: Chunk;
  const chunkSize: Vector3 = { x: 4, y: 4, z: 4 };
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
      () => true,
      new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z),
      chunkSize
    );
  });

  it("should create chunk with selection frame", () => {
    expect(chunk).toBeDefined();
    expect(chunk.minPos).toEqual(minPos);
    expect(chunk.size).toEqual(chunkSize);
    expect(chunk.getSelectionFrame()).toBeDefined();
    expect(chunk.getSelectionFrame().isEmpty()).toBe(true);
  });

  it("should handle setting and clearing selection frames", () => {
    const selectionData = {
      object: 0,
      frame: {
        minPos: { x: 0, y: 0, z: 0 },
        dimensions: { x: 4, y: 4, z: 4 },
        voxelData: new Uint8Array(64),
      },
      offset: { x: 0, y: 0, z: 0 },
    };

    selectionData.frame.voxelData[0] = 1;
    selectionData.frame.voxelData[1] = 1;

    chunk.setSelectionFrame("user1", selectionData);
    chunk.setSelectionFrame("user1", null);
    chunk.clearAllSelectionFrames();

    expect(chunk).toBeDefined();
  });

  it("should handle multiple selection frames from different users", () => {
    const selectionData1 = {
      object: 0,
      frame: {
        minPos: { x: 0, y: 0, z: 0 },
        dimensions: { x: 4, y: 4, z: 4 },
        voxelData: new Uint8Array(64),
      },
      offset: { x: 0, y: 0, z: 0 },
    };
    selectionData1.frame.voxelData[0] = 1;

    const selectionData2 = {
      object: 1,
      frame: {
        minPos: { x: 0, y: 0, z: 0 },
        dimensions: { x: 4, y: 4, z: 4 },
        voxelData: new Uint8Array(64),
      },
      offset: { x: 0, y: 0, z: 0 },
    };
    selectionData2.frame.voxelData[5] = 1;

    chunk.setSelectionFrame("user1", selectionData1);
    chunk.setSelectionFrame("user2", selectionData2);

    chunk.clearAllSelectionFrames();
    expect(chunk).toBeDefined();
  });
});

describe("Chunk per-chunk selection frame", () => {
  const chunkSize: Vector3 = { x: 4, y: 4, z: 4 };
  const worldDimensions: Vector3 = { x: 8, y: 8, z: 8 };
  const atlasData: AtlasData = {
    texture: createMockTexture(4),
    blockAtlasMapping: [0, 1],
    colors: [0xff0000, 0x00ff00],
  };

  function idx(x: number, y: number, z: number, dims: Vector3) {
    return x * dims.y * dims.z + y * dims.z + z;
  }

  it("should render selection from per-chunk selection frame", () => {
    const scene = new THREE.Scene();
    const chunk = new Chunk(
      scene,
      { x: 0, y: 0, z: 0 },
      chunkSize,
      2,
      atlasData,
      () => ({ tag: "Attach" } as BlockModificationMode),
      () => true,
      new Uint8Array(worldDimensions.x * worldDimensions.y * worldDimensions.z),
      worldDimensions
    );

    const voxels = new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z);
    voxels[idx(1, 1, 1, chunkSize)] = 1;
    chunk.setObjectChunk(0, voxels);

    const selFrame = new VoxelFrame(chunkSize);
    selFrame.setByIndex(idx(1, 1, 1, chunkSize), 1);
    chunk.setSelectionChunkFrame(selFrame);
    chunk.update();

    const mesh = chunk.getMesh();
    expect(mesh).toBeDefined();
    const isSelectedAttr = mesh!.geometry.getAttribute("isSelected");
    expect(isSelectedAttr).toBeDefined();

    const isSelectedArray = isSelectedAttr.array as Float32Array;
    const hasSelected = Array.from(isSelectedArray).some(v => v > 0.5);
    expect(hasSelected).toBe(true);
  });

  it("should not show selection when frame is empty", () => {
    const scene = new THREE.Scene();
    const chunk = new Chunk(
      scene,
      { x: 0, y: 0, z: 0 },
      chunkSize,
      2,
      atlasData,
      () => ({ tag: "Attach" } as BlockModificationMode),
      () => true,
      new Uint8Array(worldDimensions.x * worldDimensions.y * worldDimensions.z),
      worldDimensions
    );

    const voxels = new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z);
    voxels[idx(1, 1, 1, chunkSize)] = 1;
    chunk.setObjectChunk(0, voxels);

    const mesh = chunk.getMesh();
    expect(mesh).toBeDefined();
    const isSelectedAttr = mesh!.geometry.getAttribute("isSelected");
    const isSelectedArray = isSelectedAttr.array as Float32Array;
    const hasSelected = Array.from(isSelectedArray).some(v => v > 0.5);
    expect(hasSelected).toBe(false);
  });

  it("should show selection on covering voxel from higher object", () => {
    const scene = new THREE.Scene();
    const chunk = new Chunk(
      scene,
      { x: 0, y: 0, z: 0 },
      chunkSize,
      2,
      atlasData,
      () => ({ tag: "Attach" } as BlockModificationMode),
      () => true,
      new Uint8Array(worldDimensions.x * worldDimensions.y * worldDimensions.z),
      worldDimensions
    );

    const voxels0 = new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z);
    voxels0[idx(1, 1, 1, chunkSize)] = 1;
    chunk.setObjectChunk(0, voxels0);

    const voxels1 = new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z);
    voxels1[idx(1, 1, 1, chunkSize)] = 2;
    chunk.setObjectChunk(1, voxels1);

    const selFrame = new VoxelFrame(chunkSize);
    selFrame.setByIndex(idx(1, 1, 1, chunkSize), 1);
    chunk.setSelectionChunkFrame(selFrame);
    chunk.update();

    const mesh = chunk.getMesh();
    expect(mesh).toBeDefined();
    const isSelectedAttr = mesh!.geometry.getAttribute("isSelected");
    const isSelectedArray = isSelectedAttr.array as Float32Array;
    const hasSelected = Array.from(isSelectedArray).some(v => v > 0.5);
    expect(hasSelected).toBe(true);
  });

  it("should re-render when selection frame changes via version", () => {
    const scene = new THREE.Scene();
    const chunk = new Chunk(
      scene,
      { x: 0, y: 0, z: 0 },
      chunkSize,
      2,
      atlasData,
      () => ({ tag: "Attach" } as BlockModificationMode),
      () => true,
      new Uint8Array(worldDimensions.x * worldDimensions.y * worldDimensions.z),
      worldDimensions
    );

    const voxels = new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z);
    voxels[idx(1, 1, 1, chunkSize)] = 1;
    chunk.setObjectChunk(0, voxels);

    const mesh = chunk.getMesh();
    expect(mesh).toBeDefined();
    let isSelectedArray = mesh!.geometry.getAttribute("isSelected").array as Float32Array;
    let hasSelected = Array.from(isSelectedArray).some(v => v > 0.5);
    expect(hasSelected).toBe(false);

    const selFrame = new VoxelFrame(chunkSize);
    selFrame.setByIndex(idx(1, 1, 1, chunkSize), 1);
    chunk.setSelectionChunkFrame(selFrame);
    chunk.update();

    isSelectedArray = mesh!.geometry.getAttribute("isSelected").array as Float32Array;
    hasSelected = Array.from(isSelectedArray).some(v => v > 0.5);
    expect(hasSelected).toBe(true);
  });
});
