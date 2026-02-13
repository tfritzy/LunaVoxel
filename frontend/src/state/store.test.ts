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

  it("initializes object bounds from occupied voxels", () => {
    const object = stateStore.getState().objects[0];

    expect(object.position).toEqual({ x: 10, y: 0, z: 10 });
    expect(object.dimensions).toEqual({ x: 5, y: 7, z: 5 });
  });

  it("updates object bounds after voxel edits", () => {
    const current = stateStore.getState();
    const object = current.objects[0];
    const projectId = current.project.id;

    stateStore.reducers.modifyBlockRect(
      projectId,
      { tag: "Erase" },
      0,
      { x: 0, y: 0, z: 0 },
      { x: 63, y: 63, z: 63 },
      0,
      object.index
    );

    expect(stateStore.getState().objects[0].dimensions).toEqual({ x: 0, y: 0, z: 0 });

    stateStore.reducers.modifyBlockRect(
      projectId,
      { tag: "Attach" },
      1,
      { x: 3, y: 4, z: 5 },
      { x: 3, y: 4, z: 5 },
      0,
      object.index
    );

    expect(stateStore.getState().objects[0].position).toEqual({ x: 3, y: 4, z: 5 });
    expect(stateStore.getState().objects[0].dimensions).toEqual({ x: 1, y: 1, z: 1 });
  });
});
