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
});
