import { describe, it, expect, beforeEach } from "vitest";
import { stateStore, resetState, getChunkKey } from "./store";
import { BLOCK_TYPE_MASK, RAYCASTABLE_BIT } from "@/modeling/lib/voxel-constants";

describe("magicSelect reducer", () => {
  beforeEach(() => {
    resetState();
  });

  it("should select contiguous voxels of the same block type", () => {
    const state = stateStore.getState();
    const obj = [...state.objects.values()][0];

    stateStore.reducers.magicSelect(state.project.id, obj.index, {
      x: 12,
      y: 1,
      z: 12,
    });

    const sel = stateStore.getState().voxelSelection;
    expect(sel).not.toBeNull();
    expect(sel!.frame.isSet(12, 1, 12)).toBe(true);
    expect(sel!.frame.isSet(10, 0, 10)).toBe(true);
    expect(sel!.frame.isSet(14, 3, 14)).toBe(true);
  });

  it("should not select voxels of a different block type", () => {
    const state = stateStore.getState();
    const obj = [...state.objects.values()][0];

    stateStore.reducers.magicSelect(state.project.id, obj.index, {
      x: 12,
      y: 1,
      z: 12,
    });

    const sel = stateStore.getState().voxelSelection;
    expect(sel).not.toBeNull();
    expect(sel!.frame.isSet(12, 5, 12)).toBe(false);
  });

  it("should select the type 2 block region when clicking on it", () => {
    const state = stateStore.getState();
    const obj = [...state.objects.values()][0];

    stateStore.reducers.magicSelect(state.project.id, obj.index, {
      x: 12,
      y: 5,
      z: 12,
    });

    const sel = stateStore.getState().voxelSelection;
    expect(sel).not.toBeNull();
    const dims = sel!.frame.getDimensions();
    expect(dims).toEqual({ x: 3, y: 3, z: 3 });
    const minPos = sel!.frame.getMinPos();
    expect(minPos).toEqual({ x: 11, y: 4, z: 11 });

    expect(sel!.frame.isSet(11, 4, 11)).toBe(true);
    expect(sel!.frame.isSet(13, 6, 13)).toBe(true);
    expect(sel!.frame.isSet(10, 0, 10)).toBe(false);
  });

  it("should set selection to null when clicking on empty space", () => {
    const state = stateStore.getState();
    const obj = [...state.objects.values()][0];

    stateStore.reducers.magicSelect(state.project.id, obj.index, {
      x: 0,
      y: 0,
      z: 0,
    });

    expect(stateStore.getState().voxelSelection).toBeNull();
  });

  it("should produce a tight bounding box for the selection frame", () => {
    const state = stateStore.getState();
    const obj = [...state.objects.values()][0];

    stateStore.reducers.magicSelect(state.project.id, obj.index, {
      x: 12,
      y: 1,
      z: 12,
    });

    const sel = stateStore.getState().voxelSelection!;
    const dims = sel.frame.getDimensions();
    const minPos = sel.frame.getMinPos();
    expect(minPos).toEqual({ x: 10, y: 0, z: 10 });
    expect(dims).toEqual({ x: 5, y: 4, z: 5 });
  });

  it("should select only the single voxel when it is isolated", () => {
    const state = stateStore.getState();
    const obj = [...state.objects.values()][0];
    const chunk = state.chunks.get(getChunkKey(obj.id, { x: 0, y: 0, z: 0 }))!;
    const sz = chunk.size;
    chunk.voxels[1 * sz.y * sz.z + 1 * sz.z + 1] = 5 | RAYCASTABLE_BIT;

    stateStore.reducers.magicSelect(state.project.id, obj.index, {
      x: 1,
      y: 1,
      z: 1,
    });

    const sel = stateStore.getState().voxelSelection!;
    expect(sel.frame.getDimensions()).toEqual({ x: 1, y: 1, z: 1 });
    expect(sel.frame.getMinPos()).toEqual({ x: 1, y: 1, z: 1 });
    expect(sel.frame.isSet(1, 1, 1)).toBe(true);
  });

  it("should handle invalid object index gracefully", () => {
    stateStore.reducers.magicSelect("local-project", 999, {
      x: 12,
      y: 1,
      z: 12,
    });

    expect(stateStore.getState().voxelSelection).toBeNull();
  });

  it("should select all 100 voxels in the block type 1 region", () => {
    const state = stateStore.getState();
    const obj = [...state.objects.values()][0];

    stateStore.reducers.magicSelect(state.project.id, obj.index, {
      x: 10,
      y: 0,
      z: 10,
    });

    const sel = stateStore.getState().voxelSelection!;
    let count = 0;
    for (let x = 10; x <= 14; x++) {
      for (let y = 0; y <= 3; y++) {
        for (let z = 10; z <= 14; z++) {
          if (sel.frame.isSet(x, y, z)) count++;
        }
      }
    }
    expect(count).toBe(5 * 4 * 5);
  });

  it("should select all 27 voxels in the block type 2 region", () => {
    const state = stateStore.getState();
    const obj = [...state.objects.values()][0];

    stateStore.reducers.magicSelect(state.project.id, obj.index, {
      x: 12,
      y: 5,
      z: 12,
    });

    const sel = stateStore.getState().voxelSelection!;
    let count = 0;
    for (let x = 11; x <= 13; x++) {
      for (let y = 4; y <= 6; y++) {
        for (let z = 11; z <= 13; z++) {
          if (sel.frame.isSet(x, y, z)) count++;
        }
      }
    }
    expect(count).toBe(27);
  });
});
