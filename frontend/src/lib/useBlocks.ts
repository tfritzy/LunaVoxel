import { useState, useEffect } from "react";
import { DbConnection, EventContext, ProjectBlocks } from "@/module_bindings";

export const useBlocks = (
  connection: DbConnection | null,
  projectId: string
) => {
  const [blocks, setBlocks] = useState<ProjectBlocks | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connection || !projectId) return;

    const subscription = connection
      .subscriptionBuilder()
      .onApplied(() => {
        const blocksRow =
          connection.db.projectBlocks.projectId.find(projectId);
        if (blocksRow) {
          setBlocks(blocksRow);
        }
        setIsLoading(false);
      })
      .onError((error) => {
        console.error("Blocks subscription error:", error);
        setError("Failed to subscribe to blocks");
        setIsLoading(false);
      })
      .subscribe([
        `SELECT * FROM project_blocks WHERE ProjectId='${projectId}'`,
      ]);

    const onBlocksUpdate = (
      ctx: EventContext,
      oldBlocks: ProjectBlocks,
      newBlocks: ProjectBlocks
    ) => {
      if (newBlocks.projectId === projectId) {
        setBlocks(newBlocks);
      }
    };

    const onBlocksInsert = (ctx: EventContext, newBlocks: ProjectBlocks) => {
      if (newBlocks.projectId === projectId) {
        setBlocks(newBlocks);
      }
    };

    connection.db.projectBlocks.onUpdate(onBlocksUpdate);
    connection.db.projectBlocks.onInsert(onBlocksInsert);

    return () => {
      subscription.unsubscribe();
      connection.db.projectBlocks.removeOnUpdate(onBlocksUpdate);
      connection.db.projectBlocks.removeOnInsert(onBlocksInsert);
    };
  }, [connection, projectId]);

  return {
    blocks,
    isLoading,
    error,
  };
};
