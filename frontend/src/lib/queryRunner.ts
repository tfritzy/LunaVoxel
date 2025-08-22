import { DbConnection, EventContext } from "@/module_bindings";

export interface QueryState<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
}

export class QueryRunner<T> {
    private state: QueryState<T> = {
        data: null,
        loading: true,
        error: null,
    };

    private listeners: Set<(state: QueryState<T>) => void> = new Set();
    private subscription: ReturnType<ReturnType<DbConnection['subscriptionBuilder']>['subscribe']> | null = null;
    private eventHandlers: Array<() => void> = [];
    private isDestroyed = false;

    constructor(
        private sqlQuery: string,
        private filterFn: ((row: any) => boolean) | null,
        private connection: DbConnection | null
    ) {
        this.executeQuery();
    }

    private async executeQuery(): Promise<void> {
        if (!this.connection || this.isDestroyed) {
            this.updateState({ data: null, loading: false, error: null });
            return;
        }

        try {
            this.updateState({ ...this.state, loading: true, error: null });

            this.subscription = this.connection
                .subscriptionBuilder()
                .onApplied(() => {
                    if (!this.isDestroyed) {
                        const data = this.getTableData();
                        this.updateState({
                            data: data as T,
                            loading: false,
                            error: null
                        });
                    }
                })
                .onError((error) => {
                    if (!this.isDestroyed) {
                        this.updateState({
                            data: null,
                            loading: false,
                            error: error instanceof Error ? error : new Error(String(error)),
                        });
                    }
                })
                .subscribe([this.sqlQuery]);

            this.attachEventHandlers();

        } catch (error) {
            if (!this.isDestroyed) {
                this.updateState({
                    data: null,
                    loading: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                });
            }
        }
    }

    private getTableData(): any {
        if (!this.connection) return null;

        const tableName = this.extractTableName(this.sqlQuery);
        if (!tableName) return null;

        const table = (this.connection.db as any)[tableName];
        if (!table?.tableCache?.iter) return null;

        const results = Array.from(table.tableCache.iter());

        if (!this.filterFn) return results;

        return results.filter(this.filterFn);
    }

    private extractTableName(query: string): string | null {
        const fromMatch = query.match(/FROM\s+(\w+)/i);
        return fromMatch ? fromMatch[1] : null;
    }

    private attachEventHandlers(): void {
        if (!this.connection) return;

        const tableName = this.extractTableName(this.sqlQuery);
        if (!tableName) return;

        const table = (this.connection.db as any)[tableName];
        if (!table) return;

        const onInsert = (ctx: EventContext, row: any) => {
            if (!this.isDestroyed) {
                const data = this.getTableData();
                this.updateState({
                    data: data as T,
                    loading: false,
                    error: null
                });
            }
        };

        const onUpdate = (ctx: EventContext, oldRow: any, newRow: any) => {
            if (!this.isDestroyed) {
                const data = this.getTableData();
                this.updateState({
                    data: data as T,
                    loading: false,
                    error: null
                });
            }
        };

        const onDelete = (ctx: EventContext, row: any) => {
            if (!this.isDestroyed) {
                const data = this.getTableData();
                this.updateState({
                    data: data as T,
                    loading: false,
                    error: null
                });
            }
        };

        table.onInsert(onInsert);
        table.onUpdate(onUpdate);
        table.onDelete(onDelete);

        this.eventHandlers.push(() => {
            table.removeOnInsert(onInsert);
            table.removeOnUpdate(onUpdate);
            table.removeOnDelete(onDelete);
        });
    }

    private updateState(newState: QueryState<T>): void {
        this.state = newState;
        this.notifyListeners();
    }

    private notifyListeners(): void {
        this.listeners.forEach((listener) => listener(this.state));
    }

    public subscribe(listener: (state: QueryState<T>) => void): () => void {
        this.listeners.add(listener);
        listener(this.state);

        return () => {
            this.listeners.delete(listener);
        };
    }

    public updateConnection(connection: DbConnection | null): void {
        this.cleanup();
        this.connection = connection;
        this.executeQuery();
    }

    public getState(): QueryState<T> {
        return { ...this.state };
    }

    public setOptimisticData(data: T): void {
        this.updateState({
            data,
            loading: false,
            error: null,
        });
    }

    private cleanup(): void {
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }

        this.eventHandlers.forEach(cleanup => cleanup());
        this.eventHandlers = [];
    }

    public destroy(): void {
        this.isDestroyed = true;
        this.listeners.clear();
        this.cleanup();
    }
}