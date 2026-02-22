import type { StateStore } from "@/state/store";
import type { VoxelObject } from "@/state/types";

type VoxelEditEntry = {
  type: "voxelEdit";
  beforeDiff: Uint8Array;
  afterDiff: Uint8Array;
  object: number;
};

type ColorChangeEntry = {
  type: "colorChange";
  blockIndex: number;
  previousColor: number;
  newColor: number;
};

type PaletteChangeEntry = {
  type: "paletteChange";
  previousColors: number[];
  newColors: number[];
};

type ObjectRenameEntry = {
  type: "objectRename";
  objectId: string;
  previousName: string;
  newName: string;
};

type ObjectDeleteEntry = {
  type: "objectDelete";
  object: VoxelObject;
  previousIndex: number;
  chunks: Map<string, { key: string; minPos: { x: number; y: number; z: number }; size: { x: number; y: number; z: number }; voxels: Uint8Array }>;
};

type ObjectAddEntry = {
  type: "objectAdd";
  object: VoxelObject;
};

type ObjectReorderEntry = {
  type: "objectReorder";
  previousOrder: string[];
  newOrder: string[];
};

type HistoryEntry = {
  data:
    | VoxelEditEntry
    | ColorChangeEntry
    | PaletteChangeEntry
    | ObjectRenameEntry
    | ObjectDeleteEntry
    | ObjectAddEntry
    | ObjectReorderEntry;
  isUndone: boolean;
};

export class EditHistory {
  private entries: HistoryEntry[];
  private stateStore: StateStore;
  private projectId: string;

  constructor(stateStore: StateStore, projectId: string) {
    this.projectId = projectId;
    this.entries = [];
    this.stateStore = stateStore;
  }

  private truncateAtHead() {
    const headIndex = this.entries.findLastIndex((e) => !e.isUndone);
    this.entries.length = headIndex + 1;
  }

  addEntry(previous: Uint8Array, updated: Uint8Array, object: number) {
    this.truncateAtHead();

    for (let i = 0; i < previous.length; i++) {
      if (previous[i] == updated[i]) {
        previous[i] = 0;
        updated[i] = 0;
      }
    }

    this.entries.push({
      data: {
        type: "voxelEdit",
        beforeDiff: previous,
        afterDiff: updated,
        object: object,
      },
      isUndone: false,
    });
  }

  addColorChange(blockIndex: number, previousColor: number, newColor: number) {
    this.truncateAtHead();
    this.entries.push({
      data: { type: "colorChange", blockIndex, previousColor, newColor },
      isUndone: false,
    });
  }

  addPaletteChange(previousColors: number[], newColors: number[]) {
    this.truncateAtHead();
    this.entries.push({
      data: { type: "paletteChange", previousColors: [...previousColors], newColors: [...newColors] },
      isUndone: false,
    });
  }

  addObjectRename(objectId: string, previousName: string, newName: string) {
    this.truncateAtHead();
    this.entries.push({
      data: { type: "objectRename", objectId, previousName, newName },
      isUndone: false,
    });
  }

  addObjectDelete(
    object: VoxelObject,
    previousIndex: number,
    chunks: Map<string, { key: string; minPos: { x: number; y: number; z: number }; size: { x: number; y: number; z: number }; voxels: Uint8Array }>
  ) {
    this.truncateAtHead();
    this.entries.push({
      data: { type: "objectDelete", object: { ...object }, previousIndex, chunks },
      isUndone: false,
    });
  }

  addObjectAdd(object: VoxelObject) {
    this.truncateAtHead();
    this.entries.push({
      data: { type: "objectAdd", object: { ...object } },
      isUndone: false,
    });
  }

  addObjectReorder(previousOrder: string[], newOrder: string[]) {
    this.truncateAtHead();
    this.entries.push({
      data: { type: "objectReorder", previousOrder: [...previousOrder], newOrder: [...newOrder] },
      isUndone: false,
    });
  }

  undo() {
    const headIndex = this.entries.findLastIndex((e) => !e.isUndone);
    if (headIndex < 0) return;

    const head = this.entries[headIndex];
    head.isUndone = true;

    this.applyEntry(head.data, "undo");
  }

  redo() {
    const firstUndoneIndex = this.entries.findIndex((e) => e.isUndone);
    if (firstUndoneIndex < 0) return;

    const firstUndone = this.entries[firstUndoneIndex];
    firstUndone.isUndone = false;

    this.applyEntry(firstUndone.data, "redo");
  }

  private applyEntry(data: HistoryEntry["data"], direction: "undo" | "redo") {
    const reducers = this.stateStore.reducers;

    switch (data.type) {
      case "voxelEdit":
        if (direction === "undo") {
          reducers.undoEdit(this.projectId, data.beforeDiff, data.afterDiff, data.object);
        } else {
          reducers.undoEdit(this.projectId, data.afterDiff, data.beforeDiff, data.object);
        }
        break;

      case "colorChange":
        if (direction === "undo") {
          reducers.updateBlockColor(data.blockIndex, data.previousColor);
        } else {
          reducers.updateBlockColor(data.blockIndex, data.newColor);
        }
        break;

      case "paletteChange":
        if (direction === "undo") {
          reducers.setBlockColors(data.previousColors);
        } else {
          reducers.setBlockColors(data.newColors);
        }
        break;

      case "objectRename":
        if (direction === "undo") {
          reducers.renameObject(data.objectId, data.previousName);
        } else {
          reducers.renameObject(data.objectId, data.newName);
        }
        break;

      case "objectDelete":
        if (direction === "undo") {
          reducers.restoreObject(data.object, data.previousIndex, data.chunks);
        } else {
          reducers.deleteObject(data.object.id);
        }
        break;

      case "objectAdd":
        if (direction === "undo") {
          reducers.deleteObject(data.object.id);
        } else {
          reducers.restoreObject(data.object, data.object.index, new Map());
        }
        break;

      case "objectReorder":
        if (direction === "undo") {
          reducers.reorderObjects(this.projectId, data.previousOrder);
        } else {
          reducers.reorderObjects(this.projectId, data.newOrder);
        }
        break;
    }
  }
}
