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

  it("initializes object bounds from object voxel frame", () => {
    const object = stateStore.getState().objects[0];

    expect(object.position).toEqual({ x: 10, y: 0, z: 10 });
    expect(object.dimensions).toEqual({ x: 5, y: 7, z: 5 });
    expect(object.voxelDataMinPos).toEqual({ x: 0, y: 0, z: 0 });
    expect(object.voxelDataSize).toEqual({ x: 64, y: 64, z: 64 });
  });

  it("keeps object bounds minimized after attach and erase", () => {
    const current = stateStore.getState();
    const object = current.objects[0];
    const projectId = current.project.id;

    stateStore.reducers.modifyBlockRect(
      projectId,
      { tag: "Attach" },
      1,
      { x: 20, y: 20, z: 20 },
      { x: 20, y: 20, z: 20 },
      0,
      object.index
    );

    expect(stateStore.getState().objects[0].position).toEqual({ x: 10, y: 0, z: 10 });
    expect(stateStore.getState().objects[0].dimensions).toEqual({ x: 11, y: 21, z: 11 });
    expect(stateStore.getState().objects[0].voxelDataSize).toEqual({ x: 64, y: 64, z: 64 });

    stateStore.reducers.modifyBlockRect(
      projectId,
      { tag: "Erase" },
      0,
      { x: 10, y: 0, z: 10 },
      { x: 19, y: 19, z: 19 },
      0,
      object.index
    );

    expect(stateStore.getState().objects[0].position).toEqual({ x: 20, y: 20, z: 20 });
    expect(stateStore.getState().objects[0].dimensions).toEqual({ x: 1, y: 1, z: 1 });
    expect(stateStore.getState().objects[0].voxelDataSize).toEqual({ x: 64, y: 64, z: 64 });
  });
});
