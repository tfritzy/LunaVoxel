import { describe, it, expect, beforeEach } from "vitest";
import { resetState, stateStore, getChunkKey } from "./store";
import { CHUNK_SIZE } from "./constants";

function getVoxelAt(objectId: string, wx: number, wy: number, wz: number): number {
  const cx = Math.floor(wx / CHUNK_SIZE) * CHUNK_SIZE;
  const cy = Math.floor(wy / CHUNK_SIZE) * CHUNK_SIZE;
  const cz = Math.floor(wz / CHUNK_SIZE) * CHUNK_SIZE;
  const key = getChunkKey(objectId, { x: cx, y: cy, z: cz });
  const chunk = stateStore.getState().chunks.get(key);
  if (!chunk) return 0;
  const lx = wx - cx;
  const ly = wy - cy;
  const lz = wz - cz;
  return chunk.voxels[lx * chunk.size.y * chunk.size.z + ly * chunk.size.z + lz];
}

describe("commitSelectionMove", () => {
  beforeEach(() => {
    resetState();
  });

  it("moves selected voxels by the given offset", () => {
    const objectId = stateStore.getState().objects[0].id;

    expect(getVoxelAt(objectId, 10, 0, 10)).not.toBe(0);

    stateStore.reducers.selectAllVoxels("local-project", 0);
    stateStore.reducers.commitSelectionMove("local-project", { x: 1, y: 0, z: 0 });

    expect(getVoxelAt(objectId, 10, 0, 10)).toBe(0);
    expect(getVoxelAt(objectId, 11, 0, 10)).not.toBe(0);
  });

  it("wraps voxels that move past the positive boundary", () => {
    const objectId = stateStore.getState().objects[0].id;
    const dims = stateStore.getState().project.dimensions;

    stateStore.reducers.selectAllVoxels("local-project", 0);

    const offset = dims.x - 10;
    stateStore.reducers.commitSelectionMove("local-project", { x: offset, y: 0, z: 0 });

    expect(getVoxelAt(objectId, 0, 0, 10)).not.toBe(0);
    expect(getVoxelAt(objectId, 10, 0, 10)).toBe(0);
  });

  it("wraps voxels that move past the negative boundary", () => {
    const objectId = stateStore.getState().objects[0].id;

    stateStore.reducers.selectAllVoxels("local-project", 0);
    stateStore.reducers.commitSelectionMove("local-project", { x: -11, y: 0, z: 0 });

    expect(getVoxelAt(objectId, 10, 0, 10)).toBe(0);
    expect(getVoxelAt(objectId, 63, 0, 10)).not.toBe(0);
  });

  it("preserves block values through wrapped move", () => {
    const objectId = stateStore.getState().objects[0].id;
    const original = getVoxelAt(objectId, 12, 5, 12);
    expect(original).not.toBe(0);

    stateStore.reducers.selectAllVoxels("local-project", 0);
    stateStore.reducers.commitSelectionMove("local-project", { x: 55, y: 0, z: 0 });

    const movedX = (12 + 55) % 64;
    expect(getVoxelAt(objectId, movedX, 5, 12)).toBe(original);
  });

  it("updates the selection frame after move", () => {
    stateStore.reducers.selectAllVoxels("local-project", 0);
    stateStore.reducers.commitSelectionMove("local-project", { x: 5, y: 0, z: 0 });

    const sel = stateStore.getState().objects[0].selection;
    expect(sel).not.toBeNull();
  });

  it("does nothing when no object has a selection", () => {
    const objectId = stateStore.getState().objects[0].id;
    const before = getVoxelAt(objectId, 10, 0, 10);

    stateStore.reducers.commitSelectionMove("local-project", { x: 5, y: 0, z: 0 });

    expect(getVoxelAt(objectId, 10, 0, 10)).toBe(before);
  });

  it("wraps on multiple axes simultaneously", () => {
    const objectId = stateStore.getState().objects[0].id;

    stateStore.reducers.selectAllVoxels("local-project", 0);
    stateStore.reducers.commitSelectionMove("local-project", { x: 60, y: 62, z: 60 });

    const newX = (10 + 60) % 64;
    const newY = (0 + 62) % 64;
    const newZ = (10 + 60) % 64;
    expect(getVoxelAt(objectId, newX, newY, newZ)).not.toBe(0);
  });

  it("erases voxels from original positions", () => {
    const objectId = stateStore.getState().objects[0].id;

    stateStore.reducers.selectAllVoxels("local-project", 0);
    stateStore.reducers.commitSelectionMove("local-project", { x: 20, y: 0, z: 0 });

    for (let x = 10; x <= 14; x++) {
      for (let z = 10; z <= 14; z++) {
        expect(getVoxelAt(objectId, x, 0, z)).toBe(0);
      }
    }
  });
});
