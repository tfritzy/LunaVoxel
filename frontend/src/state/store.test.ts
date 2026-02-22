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

  it("adds an object to the objects map", () => {
    const beforeSize = stateStore.getState().objects.length;

    stateStore.reducers.addObject("local-project");

    const afterSize = stateStore.getState().objects.length;
    expect(afterSize).toBe(beforeSize + 1);
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

    stateStore.reducers.selectAllVoxels(project.id, objectId);
    stateStore.reducers.deleteSelectedVoxels(project.id, objectId);

    const chunkAfter = Array.from(stateStore.getState().chunks.values()).find(
      (chunk) => chunk.objectId === objectId
    );
    expect(chunkAfter?.voxels.every((v) => v === 0)).toBe(true);
  });

  it("does nothing when object has no voxels", () => {
    const objectId = stateStore.getState().objects[0].id;
    stateStore.reducers.selectAllVoxels("local-project", objectId);
    stateStore.reducers.deleteSelectedVoxels("local-project", objectId);

    stateStore.reducers.selectAllVoxels("local-project", objectId);
    stateStore.reducers.deleteSelectedVoxels("local-project", objectId);

    const chunks = Array.from(stateStore.getState().chunks.values());
    expect(chunks[0].voxels.every((v) => v === 0)).toBe(true);
  });

  it("does nothing for invalid object index", () => {
    const chunksBefore = Array.from(stateStore.getState().chunks.values());
    const voxelsBefore = chunksBefore[0].voxels.slice();

    stateStore.reducers.selectAllVoxels("local-project", "invalid-id");
    stateStore.reducers.deleteSelectedVoxels("local-project", "invalid-id");

    const chunksAfter = Array.from(stateStore.getState().chunks.values());
    expect(chunksAfter[0].voxels).toEqual(voxelsBefore);
  });
});

describe("selection chunk rebuild behavior", () => {
  beforeEach(() => {
    resetState();
  });

  it("keeps chunk selection when toggling object visibility", () => {
    const initialState = stateStore.getState();
    const object = initialState.objects[0];
    const chunk = Array.from(initialState.chunks.values()).find(
      (candidate) => candidate.objectId === object.id
    );
    expect(chunk).toBeDefined();

    stateStore.reducers.selectAllVoxels(initialState.project.id, object.id);
    expect(chunk!.selection.isEmpty()).toBe(false);

    stateStore.reducers.toggleObjectVisibility(object.id);
    expect(chunk!.selection.isEmpty()).toBe(false);

    stateStore.reducers.toggleObjectVisibility(object.id);
    expect(chunk!.selection.isEmpty()).toBe(false);
  });
});
