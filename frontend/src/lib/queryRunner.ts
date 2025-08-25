import { DbConnection, EventContext } from "@/module_bindings";
import { TableCache } from "@clockworklabs/spacetimedb-sdk";

export type TableHandle<T> = {
  tableCache: TableCache<T>;
  count: () => number;
  iter: () => Iterable<T>;
  onInsert: (cb: (ctx: EventContext, row: T) => void) => void;
  onDelete: (cb: (ctx: EventContext, row: T) => void) => void;
  onUpdate: (cb: (ctx: EventContext, oldRow: T, newRow: T) => void) => void;
  removeOnInsert?: (cb: (ctx: EventContext, row: T) => void) => void;
  removeOnDelete?: (cb: (ctx: EventContext, row: T) => void) => void;
  removeOnUpdate?: (
    cb: (ctx: EventContext, oldRow: T, newRow: T) => void
  ) => void;
};

export class QueryRunner<T> {
  private data: T[];
  private onDataUpdate: (data: T[]) => void;
  private subscription?: { unsubscribe: () => void };
  private insertCleanup?: () => void;
  private deleteCleanup?: () => void;
  private updateCleanup?: () => void;
  private isDisposed = false;

  constructor(
    db: DbConnection,
    table: TableHandle<T>,
    onDataUpdate: (data: T[]) => void
  ) {
    this.onDataUpdate = onDataUpdate;
    this.data = table.tableCache.iter();
    onDataUpdate(this.data);

    const handleDelete = () => {
      if (this.isDisposed) return;
      this.data = table.tableCache.iter();
      onDataUpdate(this.data);
    };

    const handleUpdate = () => {
      if (this.isDisposed) return;
      this.data = table.tableCache.iter();
      onDataUpdate(this.data);
    };

    const handleInsert = () => {
      if (this.isDisposed) return;
      this.data = table.tableCache.iter();
      onDataUpdate(this.data);
    };

    table.onDelete(handleDelete);
    table.onUpdate(handleUpdate);
    table.onInsert(handleInsert);

    this.insertCleanup = () => table.removeOnInsert?.(handleInsert);
    this.deleteCleanup = () => table.removeOnDelete?.(handleDelete);
    this.updateCleanup = () => table.removeOnUpdate?.(handleUpdate);
  }

  setDataOptimistically(data: T[]) {
    if (this.isDisposed) return;
    this.data = data;
    this.onDataUpdate(this.data);
  }

  dispose() {
    if (this.isDisposed) return;

    this.isDisposed = true;

    this.subscription?.unsubscribe();
    this.insertCleanup?.();
    this.deleteCleanup?.();
    this.updateCleanup?.();

    this.subscription = undefined;
    this.insertCleanup = undefined;
    this.deleteCleanup = undefined;
    this.updateCleanup = undefined;
    this.data = [];
  }

  get disposed() {
    return this.isDisposed;
  }
}
