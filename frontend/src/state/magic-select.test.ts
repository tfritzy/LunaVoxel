import { describe, it, expect, beforeEach } from "vitest";
import { stateStore, resetState, getChunkKey } from "./store";
import { BLOCK_TYPE_MASK, RAYCASTABLE_BIT } from "@/modeling/lib/voxel-constants";

describe("magicSelect reducer", () => {
  beforeEach(() => {
    resetState();
  });

  it("should select contiguous voxels of the same block type", () => {
    const state = stateStore.getState();
    const obj = state.objects[0];

    stateStore.reducers.magicSelect(state.project.id, obj.id, {
      x: 12,
      y: 1,
      z: 12,
    });

    const sel = obj.selection;
    expect(sel).not.toBeNull();
    expect(sel!.isSet(12, 1, 12)).toBe(true);
    expect(sel!.isSet(10, 0, 10)).toBe(true);
    expect(sel!.isSet(14, 3, 14)).toBe(true);
  });

  it("should not select voxels of a different block type", () => {
    const state = stateStore.getState();
    const obj = state.objects[0];

    stateStore.reducers.magicSelect(state.project.id, obj.id, {
      x: 12,
      y: 1,
      z: 12,
    });

    const sel = obj.selection;
    expect(sel).not.toBeNull();
    expect(sel!.isSet(12, 5, 12)).toBe(false);
  });

  it("should select the type 2 block region when clicking on it", () => {
    const state = stateStore.getState();
    const obj = state.objects[0];

    stateStore.reducers.magicSelect(state.project.id, obj.id, {
      x: 12,
      y: 5,
      z: 12,
    });

    const sel = obj.selection;
    expect(sel).not.toBeNull();
    const dims = sel!.getDimensions();
    expect(dims).toEqual({ x: 3, y: 3, z: 3 });
    const minPos = sel!.getMinPos();
    expect(minPos).toEqual({ x: 11, y: 4, z: 11 });

    expect(sel!.isSet(11, 4, 11)).toBe(true);
    expect(sel!.isSet(13, 6, 13)).toBe(true);
    expect(sel!.isSet(10, 0, 10)).toBe(false);
  });

  it("should set selection to null when clicking on empty space", () => {
    const state = stateStore.getState();
    const obj = state.objects[0];

    stateStore.reducers.magicSelect(state.project.id, obj.id, {
      x: 0,
      y: 0,
      z: 0,
    });

    expect(obj.selection).toBeNull();
  });

  it("should produce a tight bounding box for the selection frame", () => {
    const state = stateStore.getState();
    const obj = state.objects[0];

    stateStore.reducers.magicSelect(state.project.id, obj.id, {
      x: 12,
      y: 1,
      z: 12,
    });

    const sel = obj.selection!;
    const dims = sel.getDimensions();
    const minPos = sel.getMinPos();
    expect(minPos).toEqual({ x: 10, y: 0, z: 10 });
    expect(dims).toEqual({ x: 5, y: 4, z: 5 });
  });

  it("should select only the single voxel when it is isolated", () => {
    const state = stateStore.getState();
    const obj = state.objects[0];
    const chunk = state.chunks.get(getChunkKey(obj.id, { x: 0, y: 0, z: 0 }))!;
    const sz = chunk.size;
    chunk.voxels[1 * sz.y * sz.z + 1 * sz.z + 1] = 5 | RAYCASTABLE_BIT;

    stateStore.reducers.magicSelect(state.project.id, obj.id, {
      x: 1,
      y: 1,
      z: 1,
    });

    const sel = obj.selection!;
    expect(sel.getDimensions()).toEqual({ x: 1, y: 1, z: 1 });
    expect(sel.getMinPos()).toEqual({ x: 1, y: 1, z: 1 });
    expect(sel.isSet(1, 1, 1)).toBe(true);
  });

  it("should handle invalid object index gracefully", () => {
    const state = stateStore.getState();

    stateStore.reducers.magicSelect(state.project.id, 999, {
      x: 12,
      y: 1,
      z: 12,
    });

    expect(state.objects[0].selection).toBeNull();
  });

  it("should select all 100 voxels in the block type 1 region", () => {
    const state = stateStore.getState();
    const obj = state.objects[0];

    stateStore.reducers.magicSelect(state.project.id, obj.id, {
      x: 10,
      y: 0,
      z: 10,
    });

    const sel = obj.selection!;
    let count = 0;
    for (let x = 10; x <= 14; x++) {
      for (let y = 0; y <= 3; y++) {
        for (let z = 10; z <= 14; z++) {
          if (sel.isSet(x, y, z)) count++;
        }
      }
    }
    expect(count).toBe(5 * 4 * 5);
  });

  it("should select all 27 voxels in the block type 2 region", () => {
    const state = stateStore.getState();
    const obj = state.objects[0];

    stateStore.reducers.magicSelect(state.project.id, obj.id, {
      x: 12,
      y: 5,
      z: 12,
    });

    const sel = obj.selection!;
    let count = 0;
    for (let x = 11; x <= 13; x++) {
      for (let y = 4; y <= 6; y++) {
        for (let z = 11; z <= 13; z++) {
          if (sel.isSet(x, y, z)) count++;
        }
      }
    }
    expect(count).toBe(27);
  });
});
