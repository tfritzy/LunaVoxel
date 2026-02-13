import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ChunkManager } from "../chunk-manager";
import { CHUNK_SIZE } from "@/state/constants";
import type { StateStore } from "@/state/store";
import type { GlobalState } from "@/state/store";

const toChunkIndex = (x: number, y: number, z: number) =>
  x * CHUNK_SIZE * CHUNK_SIZE + y * CHUNK_SIZE + z;

describe("ChunkManager getObjectBounds", () => {
  it("derives bounds from non-empty voxels instead of object dimensions", () => {
    const voxels = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
    voxels[toChunkIndex(10, 1, 10)] = 1;
    voxels[toChunkIndex(14, 6, 14)] = 1;

    const state: GlobalState = {
      project: {
        id: "p1",
        dimensions: { x: 64, y: 64, z: 64 },
      },
      objects: [
        {
          id: "o1",
          projectId: "p1",
          index: 0,
          name: "Object 1",
          visible: true,
          locked: false,
          position: { x: 0, y: 0, z: 0 },
          dimensions: { x: 64, y: 64, z: 64 },
        },
      ],
      blocks: {
        projectId: "p1",
        colors: [],
      },
      chunks: new Map([
        [
          "o1:0,0,0",
          {
            key: "o1:0,0,0",
            projectId: "p1",
            objectId: "o1",
            minPos: { x: 0, y: 0, z: 0 },
            size: { x: CHUNK_SIZE, y: CHUNK_SIZE, z: CHUNK_SIZE },
            voxels,
          },
        ],
      ]),
    };

    const stateStore = {
      getState: () => state,
      subscribe: () => () => {},
      reducers: {} as StateStore["reducers"],
    };

    const manager = new ChunkManager(
      new THREE.Scene(),
      state.project.dimensions,
      stateStore,
      state.project.id,
      () => ({ tag: "Attach" })
    );

    expect(manager.getObjectBounds(0)).toEqual({
      min: { x: 10, y: 1, z: 10 },
      max: { x: 15, y: 7, z: 15 },
    });
    manager.dispose();
  });

  it("returns null for objects with no non-empty voxels", () => {
    const state: GlobalState = {
      project: {
        id: "p1",
        dimensions: { x: 64, y: 64, z: 64 },
      },
      objects: [
        {
          id: "o1",
          projectId: "p1",
          index: 0,
          name: "Object 1",
          visible: true,
          locked: false,
          position: { x: 0, y: 0, z: 0 },
          dimensions: { x: 64, y: 64, z: 64 },
        },
      ],
      blocks: {
        projectId: "p1",
        colors: [],
      },
      chunks: new Map([
        [
          "o1:0,0,0",
          {
            key: "o1:0,0,0",
            projectId: "p1",
            objectId: "o1",
            minPos: { x: 0, y: 0, z: 0 },
            size: { x: CHUNK_SIZE, y: CHUNK_SIZE, z: CHUNK_SIZE },
            voxels: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE),
          },
        ],
      ]),
    };

    const stateStore = {
      getState: () => state,
      subscribe: () => () => {},
      reducers: {} as StateStore["reducers"],
    };

    const manager = new ChunkManager(
      new THREE.Scene(),
      state.project.dimensions,
      stateStore,
      state.project.id,
      () => ({ tag: "Attach" })
    );

    expect(manager.getObjectBounds(0)).toBeNull();
    manager.dispose();
  });
});
