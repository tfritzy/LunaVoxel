import { describe, expect, it, beforeEach } from "vitest";
import { resetState, stateStore } from "./store";

describe("stateStore renameObject reducer", () => {
  beforeEach(() => {
    resetState();
  });

  it("renames the target object", () => {
    const object = stateStore.getState().objects[0];

    stateStore.reducers.renameObject(object.id, "Renamed Object");

    expect(stateStore.getState().objects[0].name).toBe("Renamed Object");
  });

  it("replaces blocks.colors when updating block color", () => {
    const before = stateStore.getState().blocks;
    const beforeColors = before.colors;

    stateStore.reducers.updateBlockColor(0, 0xff0000);

    const after = stateStore.getState().blocks;
    expect(after.colors[0]).toBe(0xff0000);
    expect(after).not.toBe(before);
    expect(after.colors).not.toBe(beforeColors);
  });

  it("sets all block colors from a palette via setBlockColors", () => {
    const palette = [0xaa0000, 0x00bb00, 0x0000cc];
    stateStore.reducers.setBlockColors(palette);

    const colors = stateStore.getState().blocks.colors;
    expect(colors[0]).toBe(0xaa0000);
    expect(colors[1]).toBe(0x00bb00);
    expect(colors[2]).toBe(0x0000cc);
    expect(colors[3]).toBe(0x393a4b);
    expect(colors.length).toBe(127);
  });

  it("initializes with non-uniform default palette colors", () => {
    const colors = stateStore.getState().blocks.colors;
    const unique = new Set(colors);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe("selectAllVoxels and deleteSelectedVoxels", () => {
  beforeEach(() => {
    resetState();
  });

  it("selects all then deletes all voxels in the current object", () => {
    const { project } = stateStore.getState();
    const objectId = stateStore.getState().objects[0].id;
    const chunkBefore = Array.from(stateStore.getState().chunks.values()).find(
      (chunk) => chunk.objectId === objectId
    );
    expect(chunkBefore).toBeDefined();
    expect(chunkBefore?.voxels.some((v) => v !== 0)).toBe(true);

    stateStore.reducers.selectAllVoxels(project.id, 0);
    stateStore.reducers.deleteSelectedVoxels(project.id, 0);

    const chunkAfter = Array.from(stateStore.getState().chunks.values()).find(
      (chunk) => chunk.objectId === objectId
    );
    expect(chunkAfter?.voxels.every((v) => v === 0)).toBe(true);
  });

  it("does nothing when object has no voxels", () => {
    stateStore.reducers.selectAllVoxels("local-project", 0);
    stateStore.reducers.deleteSelectedVoxels("local-project", 0);

    stateStore.reducers.selectAllVoxels("local-project", 0);
    stateStore.reducers.deleteSelectedVoxels("local-project", 0);

    const chunks = Array.from(stateStore.getState().chunks.values());
    expect(chunks[0].voxels.every((v) => v === 0)).toBe(true);
  });

  it("does nothing for invalid object index", () => {
    const chunksBefore = Array.from(stateStore.getState().chunks.values());
    const voxelsBefore = chunksBefore[0].voxels.slice();

    stateStore.reducers.selectAllVoxels("local-project", 999);
    stateStore.reducers.deleteSelectedVoxels("local-project", 999);

    const chunksAfter = Array.from(stateStore.getState().chunks.values());
    expect(chunksAfter[0].voxels).toEqual(voxelsBefore);
  });
});

describe("resizeProject", () => {
  beforeEach(() => {
    resetState();
  });

  const getVoxelAt = (x: number, y: number, z: number) => {
    const dims = stateStore.getState().project.dimensions;
    const objectId = stateStore.getState().objects[0].id;
    for (const chunk of stateStore.getState().chunks.values()) {
      if (chunk.objectId !== objectId) continue;
      const lx = x - chunk.minPos.x;
      const ly = y - chunk.minPos.y;
      const lz = z - chunk.minPos.z;
      if (lx < 0 || ly < 0 || lz < 0 ||
          lx >= chunk.size.x || ly >= chunk.size.y || lz >= chunk.size.z) continue;
      void dims;
      return chunk.voxels[lx * chunk.size.y * chunk.size.z + ly * chunk.size.z + lz];
    }
    return 0;
  };

  it("updates project and object dimensions", () => {
    stateStore.reducers.resizeProject(
      { x: 128, y: 128, z: 128 },
      { x: 0, y: 0, z: 0 }
    );

    const { project, objects } = stateStore.getState();
    expect(project.dimensions).toEqual({ x: 128, y: 128, z: 128 });
    expect(objects[0].dimensions).toEqual({ x: 128, y: 128, z: 128 });
  });

  it("preserves voxels when expanding with anchor at origin", () => {
    stateStore.reducers.resizeProject(
      { x: 128, y: 128, z: 128 },
      { x: 0, y: 0, z: 0 }
    );

    expect(getVoxelAt(10, 0, 10)).not.toBe(0);
    expect(getVoxelAt(14, 3, 14)).not.toBe(0);
    expect(getVoxelAt(12, 5, 12)).not.toBe(0);
  });

  it("shifts voxels when expanding with anchor at 1,1,1", () => {
    stateStore.reducers.resizeProject(
      { x: 128, y: 128, z: 128 },
      { x: 1, y: 1, z: 1 }
    );

    const offset = 128 - 64;
    expect(getVoxelAt(10 + offset, 0 + offset, 10 + offset)).not.toBe(0);
    expect(getVoxelAt(14 + offset, 3 + offset, 14 + offset)).not.toBe(0);
  });

  it("shifts voxels when expanding with centered anchor", () => {
    stateStore.reducers.resizeProject(
      { x: 128, y: 128, z: 128 },
      { x: 0.5, y: 0.5, z: 0.5 }
    );

    const offset = 32;
    expect(getVoxelAt(10 + offset, 0 + offset, 10 + offset)).not.toBe(0);
  });

  it("shrinks project and clips out-of-bounds voxels", () => {
    stateStore.reducers.resizeProject(
      { x: 12, y: 12, z: 12 },
      { x: 0, y: 0, z: 0 }
    );

    const { project } = stateStore.getState();
    expect(project.dimensions).toEqual({ x: 12, y: 12, z: 12 });
    expect(getVoxelAt(10, 0, 10)).not.toBe(0);
    expect(getVoxelAt(11, 1, 11)).not.toBe(0);
    expect(getVoxelAt(14, 3, 14)).toBe(0);
  });

  it("clears selections on resize", () => {
    stateStore.reducers.selectAllVoxels("local-project", 0);
    expect(stateStore.getState().objects[0].selection).not.toBeNull();

    stateStore.reducers.resizeProject(
      { x: 128, y: 128, z: 128 },
      { x: 0, y: 0, z: 0 }
    );

    expect(stateStore.getState().objects[0].selection).toBeNull();
  });
});
