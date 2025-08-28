import { DbConnection } from "@/module_bindings";
import { compressVoxelData } from "./voxel-data-utils";

type HistoryEntry = {
  beforeDiff: Uint32Array;
  afterDiff: Uint32Array;
  layer: number;
  isUndone: boolean;
};

export class EditHistory {
  private entries: HistoryEntry[];
  private db: DbConnection;
  private projectId: string;

  constructor(db: DbConnection, projectId: string) {
    this.projectId = projectId;
    this.entries = [];
    this.db = db;
  }

  addEntry(previous: Uint32Array, updated: Uint32Array, layer: number) {
    const headIndex = this.entries.findLastIndex((e) => !e.isUndone);
    this.entries.length = headIndex + 1;

    for (let i = 0; i < previous.length; i++) {
      if (previous[i] == updated[i]) {
        previous[i] = 0;
        updated[i] = 0;
      }
    }

    this.entries.push({
      beforeDiff: previous,
      afterDiff: updated,
      layer: layer,
      isUndone: false,
    });
  }

  undo() {
    const headIndex = this.entries.findLastIndex((e) => !e.isUndone);
    if (headIndex < 0) return;

    const head = this.entries[headIndex];
    head.isUndone = true;

    this.db.reducers.undoEdit(
      this.projectId,
      compressVoxelData(head.beforeDiff),
      compressVoxelData(head.afterDiff),
      head.layer
    );
  }

  redo() {
    const firstUndoneIndex = this.entries.findIndex((e) => e.isUndone);
    if (firstUndoneIndex < 0) return;

    const firstUndone = this.entries[firstUndoneIndex];
    firstUndone.isUndone = false;

    this.db.reducers.undoEdit(
      this.projectId,
      compressVoxelData(firstUndone.afterDiff),
      compressVoxelData(firstUndone.beforeDiff),
      firstUndone.layer
    );
  }
}