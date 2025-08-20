import { compressVoxelData } from "./voxel-data-utils";

type HistoryEntry = {
  beforeDiff: Uint8Array;
  afterDiff: Uint8Array;
  layer: number;
  isUndone: boolean;
};

export class EditHistory {
  private entries: HistoryEntry[];
  private applyEdit: (layer: number, diff: Uint8Array) => void;

  constructor(applyEdit: (layer: number, diff: Uint8Array) => void) {
    this.entries = [];
    this.applyEdit = applyEdit;
  }

  addEntry(previous: Uint32Array, updated: Uint32Array, layer: number) {
    const headIndex = this.entries.findLastIndex((e) => !e.isUndone);
    this.entries.length = headIndex + 1;

    for (let i = 0; i < previous.length; i++) {
      if (previous[i] == updated[i]) {
        // Not part of the diff.
        previous[i] = 0;
        updated[i] = 0;
      }
    }

    this.entries.push({
      beforeDiff: compressVoxelData(previous),
      afterDiff: compressVoxelData(updated),
      layer: layer,
      isUndone: false,
    });
  }

  undo() {
    const headIndex = this.entries.findLastIndex((e) => !e.isUndone);
    if (headIndex < 0) return;
    const head = this.entries[headIndex];
    head.isUndone = true;
    this.applyEdit(head.layer, head.beforeDiff);
  }

  redo() {
    const firstUndoneIndex = this.entries.findIndex((e) => e.isUndone);
    if (firstUndoneIndex < 0) return;
    const firstUndone = this.entries[firstUndoneIndex];
    firstUndone.isUndone = false;
    this.applyEdit(firstUndone.layer, firstUndone.afterDiff);
  }
}
