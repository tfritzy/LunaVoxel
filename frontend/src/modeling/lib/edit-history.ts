import type { StateStore } from "@/state/store";

type HistoryEntry = {
  beforeDiff: Uint8Array;
  afterDiff: Uint8Array;
  layer: number;
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

  addEntry(previous: Uint8Array, updated: Uint8Array, layer: number) {
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

    this.stateStore.reducers.undoEdit(
      this.projectId,
      head.beforeDiff,
      head.afterDiff,
      head.layer
    );
  }

  redo() {
    const firstUndoneIndex = this.entries.findIndex((e) => e.isUndone);
    if (firstUndoneIndex < 0) return;

    const firstUndone = this.entries[firstUndoneIndex];
    firstUndone.isUndone = false;

    this.stateStore.reducers.undoEdit(
      this.projectId,
      firstUndone.afterDiff,
      firstUndone.beforeDiff,
      firstUndone.layer
    );
  }
}
