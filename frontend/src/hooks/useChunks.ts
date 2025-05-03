import { useEffect, useState } from "react";
import { Chunk, DbConnection, EventContext } from "../module_bindings";

export function useChunks(conn: DbConnection | null, world: string): Chunk[] {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  console.log(chunks);

  useEffect(() => {
    if (!conn) return;
    const onInsert = (_ctx: EventContext, chunk: Chunk) => {
      setChunks((prev) => [...prev, chunk]);
    };
    conn.db.chunk.onInsert(onInsert);

    const onDelete = (_ctx: EventContext, chunk: Chunk) => {
      setChunks((prev) => prev.filter((c) => c.id === chunk.id));
    };
    conn.db.chunk.onDelete(onDelete);

    return () => {
      conn.db.chunk.removeOnInsert(onInsert);
      conn.db.chunk.removeOnDelete(onDelete);
    };
  }, [conn]);

  return chunks;
}
