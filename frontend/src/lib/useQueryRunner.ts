import { useCallback, useEffect, useRef, useState } from "react";
import { QueryRunner, TableHandle } from "./queryRunner";

export function useQueryRunner<T>(
  db: unknown | null,
  getTable: (db: unknown) => TableHandle<T>,
  filter?: (data: T) => boolean
): { data: T[] } & { setDataOptimistically: (data: T[]) => void } {
  const queryRunnerRef = useRef<QueryRunner<T> | null>(null);
  const [data, setData] = useState<T[]>([]);

  const setDataOptimistically = useCallback((data: T[]) => {
    queryRunnerRef.current?.setDataOptimistically(data);
  }, []);

  const onDataUpdate = useCallback((data: T[]) => {
    setData(data);
  }, []);

  useEffect(() => {
    if (!db) return;

    const queryRunner = new QueryRunner<T>(getTable(db), onDataUpdate, filter);
    queryRunnerRef.current = queryRunner;

    return () => {
      queryRunnerRef.current?.dispose();
      queryRunnerRef.current = null;
    };
  }, [db, getTable, onDataUpdate]);

  return { data, setDataOptimistically };
}
