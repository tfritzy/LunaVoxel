import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ChunkManager } from "../chunk-manager";
import type { StateStore } from "@/state/store";
import type { GlobalState } from "@/state/store";

describe("ChunkManager getObjectBounds", () => {
  it("derives bounds from object dimensions", () => {
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
          position: { x: 10, y: 1, z: 10 },
          dimensions: { x: 5, y: 6, z: 5 },
        },
      ],
      blocks: {
        projectId: "p1",
        colors: [],
      },
      chunks: new Map(),
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

  it("returns null for objects with empty dimensions", () => {
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
          dimensions: { x: 0, y: 0, z: 0 },
        },
      ],
      blocks: {
        projectId: "p1",
        colors: [],
      },
      chunks: new Map(),
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
