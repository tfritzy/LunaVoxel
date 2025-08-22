import { useEffect, useRef, useState } from "react";
import { useDatabase } from "@/contexts/DatabaseContext";
import { QueryRunner, QueryState } from "./queryRunner";

export function useQueryRunner<T>(
    sqlQuery: string,
    filterFn?: (row: any) => boolean
): QueryState<T> & { setOptimisticData: (data: T) => void } {
    const { connection } = useDatabase();
    const queryRunnerRef = useRef<QueryRunner<T> | null>(null);
    const [state, setState] = useState<QueryState<T>>({
        data: null,
        loading: true,
        error: null,
    });

    const setOptimisticData = (data: T) => {
        queryRunnerRef.current?.setOptimisticData(data);
    };

    useEffect(() => {
        const queryRunner = new QueryRunner<T>(sqlQuery, filterFn || null, connection);
        queryRunnerRef.current = queryRunner;

        const unsubscribe = queryRunner.subscribe(setState);

        return () => {
            unsubscribe();
            queryRunner.destroy();
            queryRunnerRef.current = null;
        };
    }, [sqlQuery, filterFn, connection]);

    useEffect(() => {
        if (queryRunnerRef.current) {
            queryRunnerRef.current.updateConnection(connection);
        }
    }, [connection]);

    return { ...state, setOptimisticData };
}