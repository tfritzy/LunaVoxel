import { describe, it, expect, beforeEach } from "vitest";
import { Chunk } from "../chunk";
import * as THREE from "three";
import type { Vector3, BlockModificationMode } from "@/state/types";
import { AtlasData } from "@/lib/useAtlas";

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
      3, // 3 objects
      mockAtlasData,
      () => ({ tag: "Attach" } as BlockModificationMode),
      () => true // all objects visible
    );
  });

  it("should create chunk with merged selection frame", () => {
    expect(chunk).toBeDefined();
    expect(chunk.minPos).toEqual(minPos);
    expect(chunk.size).toEqual(chunkSize);
  });

  it("should handle setting and clearing selection frames", () => {
    const selectionData = {
      object: 0,
      frame: {
        minPos: { x: 0, y: 0, z: 0 },
        dimensions: { x: 4, y: 4, z: 4 },
        voxelData: new Uint8Array(64), // 4x4x4 = 64 voxels
      },
      offset: { x: 0, y: 0, z: 0 },
    };

    // Set a few voxels in the selection
    selectionData.frame.voxelData[0] = 1; // x=0, y=0, z=0
    selectionData.frame.voxelData[1] = 1; // x=0, y=0, z=1

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
