import { describe, it, expect, beforeEach } from "vitest";
import { EditHistory } from "../edit-history";
import { resetState, stateStore, getChunkKey, registerEditHistory } from "@/state/store";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import { VoxelFrame } from "../voxel-frame";
import type { VoxelObject } from "@/state/types";

describe("EditHistory", () => {
  let history: EditHistory;

  beforeEach(() => {
    resetState();
    history = new EditHistory(stateStore, "local-project");
    registerEditHistory(history);
  });

  describe("color changes", () => {
    it("undoes a color change", () => {
      const originalColor = stateStore.getState().blocks.colors[0];
      stateStore.reducers.updateBlockColor(0, 0xff0000);
      history.addColorChange(0, originalColor, 0xff0000);

      expect(stateStore.getState().blocks.colors[0]).toBe(0xff0000);

      history.undo();
      expect(stateStore.getState().blocks.colors[0]).toBe(originalColor);
    });

    it("redoes a color change", () => {
      const originalColor = stateStore.getState().blocks.colors[0];
      stateStore.reducers.updateBlockColor(0, 0xff0000);
      history.addColorChange(0, originalColor, 0xff0000);

      history.undo();
      expect(stateStore.getState().blocks.colors[0]).toBe(originalColor);

      history.redo();
      expect(stateStore.getState().blocks.colors[0]).toBe(0xff0000);
    });

    it("undoes multiple color changes in order", () => {
      const color0 = stateStore.getState().blocks.colors[0];
      const color1 = stateStore.getState().blocks.colors[1];

      stateStore.reducers.updateBlockColor(0, 0xaa0000);
      history.addColorChange(0, color0, 0xaa0000);

      stateStore.reducers.updateBlockColor(1, 0x00bb00);
      history.addColorChange(1, color1, 0x00bb00);

      history.undo();
      expect(stateStore.getState().blocks.colors[1]).toBe(color1);
      expect(stateStore.getState().blocks.colors[0]).toBe(0xaa0000);

      history.undo();
      expect(stateStore.getState().blocks.colors[0]).toBe(color0);
    });
  });

  describe("palette changes", () => {
    it("undoes a palette change", () => {
      const originalColors = [...stateStore.getState().blocks.colors];
      const newPalette = [0x111111, 0x222222, 0x333333];

      stateStore.reducers.setBlockColors(newPalette);
      const newColors = [...stateStore.getState().blocks.colors];
      history.addPaletteChange(originalColors, newColors);

      expect(stateStore.getState().blocks.colors[0]).toBe(0x111111);

      history.undo();
      expect(stateStore.getState().blocks.colors).toEqual(originalColors);
    });

    it("redoes a palette change", () => {
      const originalColors = [...stateStore.getState().blocks.colors];
      const newPalette = [0x111111, 0x222222, 0x333333];

      stateStore.reducers.setBlockColors(newPalette);
      const newColors = [...stateStore.getState().blocks.colors];
      history.addPaletteChange(originalColors, newColors);

      history.undo();
      history.redo();
      expect(stateStore.getState().blocks.colors[0]).toBe(0x111111);
    });
  });

  describe("object rename", () => {
    it("undoes a rename", () => {
      const obj = stateStore.getState().objects[0];
      const originalName = obj.name;

      stateStore.reducers.renameObject(obj.id, "New Name");
      history.addObjectRename(obj.id, originalName, "New Name");

      expect(stateStore.getState().objects[0].name).toBe("New Name");

      history.undo();
      expect(stateStore.getState().objects[0].name).toBe(originalName);
    });

    it("redoes a rename", () => {
      const obj = stateStore.getState().objects[0];
      const originalName = obj.name;

      stateStore.reducers.renameObject(obj.id, "New Name");
      history.addObjectRename(obj.id, originalName, "New Name");

      history.undo();
      history.redo();
      expect(stateStore.getState().objects[0].name).toBe("New Name");
    });
  });

  describe("object add", () => {
    it("undoes an object add", () => {
      stateStore.reducers.addObject("local-project");
      const added = stateStore.getState().objects[1];
      history.addObjectAdd(added);

      expect(stateStore.getState().objects.length).toBe(2);

      history.undo();
      expect(stateStore.getState().objects.length).toBe(1);
    });

    it("redoes an object add", () => {
      stateStore.reducers.addObject("local-project");
      const added = stateStore.getState().objects[1];
      history.addObjectAdd(added);

      history.undo();
      expect(stateStore.getState().objects.length).toBe(1);

      history.redo();
      expect(stateStore.getState().objects.length).toBe(2);
    });
  });

  describe("object delete", () => {
    it("undoes an object delete", () => {
      stateStore.reducers.addObject("local-project");
      const objectToDelete = stateStore.getState().objects[1];
      const previousIndex = 1;

      stateStore.reducers.deleteObject(objectToDelete.id);
      history.addObjectDelete(objectToDelete, previousIndex, new Map());

      expect(stateStore.getState().objects.length).toBe(1);

      history.undo();
      expect(stateStore.getState().objects.length).toBe(2);
      expect(
        stateStore.getState().objects.find((o) => o.id === objectToDelete.id)
      ).toBeDefined();
    });

    it("redoes an object delete", () => {
      stateStore.reducers.addObject("local-project");
      const objectToDelete = stateStore.getState().objects[1];
      const previousIndex = 1;

      stateStore.reducers.deleteObject(objectToDelete.id);
      history.addObjectDelete(objectToDelete, previousIndex, new Map());

      history.undo();
      history.redo();
      expect(stateStore.getState().objects.length).toBe(1);
    });
  });

  describe("object reorder", () => {
    it("undoes a reorder", () => {
      stateStore.reducers.addObject("local-project");
      const previousOrder = stateStore.getState().objects.map((o) => o.id);
      const newOrder = [...previousOrder].reverse();

      stateStore.reducers.reorderObjects("local-project", newOrder);
      history.addObjectReorder(previousOrder, newOrder);

      expect(stateStore.getState().objects[0].id).toBe(previousOrder[1]);

      history.undo();
      expect(stateStore.getState().objects[0].id).toBe(previousOrder[0]);
    });

    it("redoes a reorder", () => {
      stateStore.reducers.addObject("local-project");
      const previousOrder = stateStore.getState().objects.map((o) => o.id);
      const newOrder = [...previousOrder].reverse();

      stateStore.reducers.reorderObjects("local-project", newOrder);
      history.addObjectReorder(previousOrder, newOrder);

      history.undo();
      history.redo();
      expect(stateStore.getState().objects[0].id).toBe(previousOrder[1]);
    });
  });

  describe("mixed operations", () => {
    it("undoes and redoes mixed entry types", () => {
      const originalColor = stateStore.getState().blocks.colors[0];
      const obj = stateStore.getState().objects[0];
      const originalName = obj.name;

      stateStore.reducers.updateBlockColor(0, 0xff0000);
      history.addColorChange(0, originalColor, 0xff0000);

      stateStore.reducers.renameObject(obj.id, "Renamed");
      history.addObjectRename(obj.id, originalName, "Renamed");

      history.undo();
      expect(stateStore.getState().objects[0].name).toBe(originalName);
      expect(stateStore.getState().blocks.colors[0]).toBe(0xff0000);

      history.undo();
      expect(stateStore.getState().blocks.colors[0]).toBe(originalColor);

      history.redo();
      expect(stateStore.getState().blocks.colors[0]).toBe(0xff0000);

      history.redo();
      expect(stateStore.getState().objects[0].name).toBe("Renamed");
    });

    it("truncates redo stack when new entry is added after undo", () => {
      const originalColor = stateStore.getState().blocks.colors[0];

      stateStore.reducers.updateBlockColor(0, 0xff0000);
      history.addColorChange(0, originalColor, 0xff0000);

      stateStore.reducers.updateBlockColor(0, 0x00ff00);
      history.addColorChange(0, 0xff0000, 0x00ff00);

      history.undo();
      expect(stateStore.getState().blocks.colors[0]).toBe(0xff0000);

      stateStore.reducers.updateBlockColor(0, 0x0000ff);
      history.addColorChange(0, 0xff0000, 0x0000ff);

      history.redo();
      expect(stateStore.getState().blocks.colors[0]).toBe(0x0000ff);
    });
  });

  describe("voxel edits", () => {
    const getVoxel = (x: number, y: number, z: number) => {
      const obj = stateStore.getState().objects[0];
      const key = getChunkKey(obj.id, { x: 0, y: 0, z: 0 });
      const chunk = stateStore.getState().chunks.get(key);
      if (!chunk) return 0;
      return chunk.voxels[x * chunk.size.y * chunk.size.z + y * chunk.size.z + z];
    };

    it("undoes a voxel edit", () => {
      const dims = stateStore.getState().project.dimensions;
      const total = dims.x * dims.y * dims.z;
      const previous = new Uint8Array(total);
      const updated = new Uint8Array(total);
      const idx = 5 * dims.y * dims.z + 5 * dims.z + 5;

      const oldVal = getVoxel(5, 5, 5);
      previous[idx] = oldVal;
      const newVal = 1 | RAYCASTABLE_BIT;
      updated[idx] = newVal;

      stateStore.reducers.undoEdit("local-project", updated, previous, stateStore.getState().objects[0].id);
      history.addEntry(new Uint8Array(previous), new Uint8Array(updated), stateStore.getState().objects[0].id);

      expect(getVoxel(5, 5, 5)).toBe(newVal);

      history.undo();
      expect(getVoxel(5, 5, 5)).toBe(oldVal);
    });

    it("redoes a voxel edit", () => {
      const dims = stateStore.getState().project.dimensions;
      const total = dims.x * dims.y * dims.z;
      const previous = new Uint8Array(total);
      const updated = new Uint8Array(total);
      const idx = 5 * dims.y * dims.z + 5 * dims.z + 5;

      const oldVal = getVoxel(5, 5, 5);
      previous[idx] = oldVal;
      const newVal = 1 | RAYCASTABLE_BIT;
      updated[idx] = newVal;

      stateStore.reducers.undoEdit("local-project", updated, previous, stateStore.getState().objects[0].id);
      history.addEntry(new Uint8Array(previous), new Uint8Array(updated), stateStore.getState().objects[0].id);

      history.undo();
      expect(getVoxel(5, 5, 5)).toBe(oldVal);

      history.redo();
      expect(getVoxel(5, 5, 5)).toBe(newVal);
    });
  });

  describe("voxel edit via applyFrame auto-history", () => {
    const getVoxel = (x: number, y: number, z: number) => {
      const obj = stateStore.getState().objects[0];
      const key = getChunkKey(obj.id, { x: 0, y: 0, z: 0 });
      const chunk = stateStore.getState().chunks.get(key);
      if (!chunk) return 0;
      return chunk.voxels[x * chunk.size.y * chunk.size.z + y * chunk.size.z + z];
    };

    it("undoes applyFrame edit automatically", () => {
      const dims = stateStore.getState().project.dimensions;
      const frame = new VoxelFrame(dims, { x: 0, y: 0, z: 0 });
      frame.set(5, 5, 5, 1);
      stateStore.reducers.applyFrame({ tag: "Attach" }, 3, frame, stateStore.getState().objects[0].id);

      expect(getVoxel(5, 5, 5)).toBe(3 | RAYCASTABLE_BIT);

      history.undo();
      expect(getVoxel(5, 5, 5)).toBe(0);
    });

    it("redoes applyFrame edit automatically", () => {
      const dims = stateStore.getState().project.dimensions;
      const frame = new VoxelFrame(dims, { x: 0, y: 0, z: 0 });
      frame.set(5, 5, 5, 1);
      stateStore.reducers.applyFrame({ tag: "Attach" }, 3, frame, stateStore.getState().objects[0].id);

      history.undo();
      expect(getVoxel(5, 5, 5)).toBe(0);

      history.redo();
      expect(getVoxel(5, 5, 5)).toBe(3 | RAYCASTABLE_BIT);
    });

    it("undoes and redoes multiple applyFrame edits", () => {
      const dims = stateStore.getState().project.dimensions;

      const frame1 = new VoxelFrame(dims, { x: 0, y: 0, z: 0 });
      frame1.set(1, 1, 1, 1);
      stateStore.reducers.applyFrame({ tag: "Attach" }, 2, frame1, stateStore.getState().objects[0].id);

      const frame2 = new VoxelFrame(dims, { x: 0, y: 0, z: 0 });
      frame2.set(2, 2, 2, 1);
      stateStore.reducers.applyFrame({ tag: "Attach" }, 4, frame2, stateStore.getState().objects[0].id);

      expect(getVoxel(1, 1, 1)).toBe(2 | RAYCASTABLE_BIT);
      expect(getVoxel(2, 2, 2)).toBe(4 | RAYCASTABLE_BIT);

      history.undo();
      expect(getVoxel(1, 1, 1)).toBe(2 | RAYCASTABLE_BIT);
      expect(getVoxel(2, 2, 2)).toBe(0);

      history.undo();
      expect(getVoxel(1, 1, 1)).toBe(0);

      history.redo();
      expect(getVoxel(1, 1, 1)).toBe(2 | RAYCASTABLE_BIT);

      history.redo();
      expect(getVoxel(2, 2, 2)).toBe(4 | RAYCASTABLE_BIT);
    });

    it("undoes erase applyFrame edit automatically", () => {
      const existingVal = 1 | RAYCASTABLE_BIT;
      expect(getVoxel(12, 2, 12)).toBe(existingVal);

      const dims = stateStore.getState().project.dimensions;
      const frame = new VoxelFrame(dims, { x: 0, y: 0, z: 0 });
      frame.set(12, 2, 12, 1);
      stateStore.reducers.applyFrame({ tag: "Erase" }, 0, frame, stateStore.getState().objects[0].id);

      expect(getVoxel(12, 2, 12)).toBe(0);

      history.undo();
      expect(getVoxel(12, 2, 12)).toBe(existingVal);
    });
  });
});
