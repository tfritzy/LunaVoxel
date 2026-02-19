import { describe, it, expect, beforeEach } from "vitest";
import { Chunk } from "../chunk";
import * as THREE from "three";
import type { Vector3, BlockModificationMode } from "@/state/types";
import { AtlasData } from "@/lib/useAtlas";

function createMockTexture(width: number): THREE.Texture {
  const texture = { image: { width } } as unknown as THREE.Texture;
  return texture;
}

describe("Chunk atlas update", () => {
  let scene: THREE.Scene;
  let chunk: Chunk;
  const chunkSize: Vector3 = { x: 4, y: 4, z: 4 };
  const minPos: Vector3 = { x: 0, y: 0, z: 0 };

  const atlasData1: AtlasData = {
    texture: createMockTexture(4),
    blockAtlasMapping: [0, 1],
    colors: [0xff0000, 0x00ff00],
  };

  const atlasData2: AtlasData = {
    texture: createMockTexture(4),
    blockAtlasMapping: [1, 0],
    colors: [0xff0000, 0x00ff00],
  };

  beforeEach(() => {
    scene = new THREE.Scene();
    chunk = new Chunk(
      scene,
      minPos,
      chunkSize,
      3,
      atlasData1,
      () => ({ tag: "Attach" } as BlockModificationMode),
      () => true,
      new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z),
      chunkSize,
      new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z)
    );
  });

  it("should re-render mesh when atlas changes even if voxel data is the same", () => {
    const voxels = new Uint8Array(64);
    voxels[0] = 1;
    chunk.setObjectChunk(0, voxels);

    const mesh = chunk.getMesh();
    expect(mesh).toBeDefined();
    const uvsAfterFirstRender = mesh!.geometry.getAttribute("uv");
    const firstUVs = new Float32Array(uvsAfterFirstRender.array);

    chunk.setTextureAtlas(atlasData2);

    const uvsAfterAtlasChange = mesh!.geometry.getAttribute("uv");
    const secondUVs = new Float32Array(uvsAfterAtlasChange.array);

    expect(secondUVs).not.toEqual(firstUVs);
  });

  it("should not re-render when update is called with unchanged voxel data", () => {
    const voxels = new Uint8Array(64);
    voxels[0] = 1;
    chunk.setObjectChunk(0, voxels);

    const mesh = chunk.getMesh();
    expect(mesh).toBeDefined();
    const uvsAfterFirstRender = mesh!.geometry.getAttribute("uv");
    const firstUVs = new Float32Array(uvsAfterFirstRender.array);

    chunk.update();

    const uvsAfterSecondUpdate = mesh!.geometry.getAttribute("uv");
    const secondUVs = new Float32Array(uvsAfterSecondUpdate.array);

    expect(secondUVs).toEqual(firstUVs);
  });
});
