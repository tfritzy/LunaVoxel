import { useState, useEffect } from "react";
import { DbConnection, EventContext, Layer } from "@/module_bindings";

export const useLayers = (
  connection: DbConnection | null,
  projectId: string
) => {
  const [selectedLayer, setSelectedLayer] = useState<number>(0);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connection || !projectId) return;

    const subscription = connection
      .subscriptionBuilder()
      .onApplied(() => {
        const projectLayers = Array.from(connection.db.layer.tableCache.iter())
          .filter((layer: Layer) => layer.projectId === projectId)
          .sort((a: Layer, b: Layer) => a.index - b.index);

        setLayers(projectLayers);
        setIsLoading(false);
      })
      .onError((error) => {
        console.error("Layers subscription error:", error);
        setError("Failed to subscribe to layers");
        setIsLoading(false);
      })
      .subscribe([`SELECT * FROM layer WHERE ProjectId='${projectId}'`]);

    const onLayerUpdate = (
      ctx: EventContext,
      oldLayer: Layer,
      newLayer: Layer
    ) => {
      if (newLayer.projectId === projectId) {
        setLayers((prev) =>
          prev
            .map((layer) => (layer.id === newLayer.id ? newLayer : layer))
            .sort((a, b) => a.index - b.index)
        );
      }
    };

    const onLayerInsert = (ctx: EventContext, newLayer: Layer) => {
      if (newLayer.projectId === projectId) {
        setLayers((prev) => {
          const exists = prev.some((layer) => layer.id === newLayer.id);
          if (exists) {
            return prev;
          }
          setSelectedLayer(newLayer.index);
          return [...prev, newLayer].sort((a, b) => a.index - b.index);
        });
      }
    };

    const onLayerDelete = (ctx: EventContext, deletedLayer: Layer) => {
      if (deletedLayer.projectId === projectId) {
        setLayers((prev) =>
          prev.filter((layer) => layer.id !== deletedLayer.id)
        );
      }
    };

    connection.db.layer.onUpdate(onLayerUpdate);
    connection.db.layer.onInsert(onLayerInsert);
    connection.db.layer.onDelete(onLayerDelete);

    return () => {
      subscription.unsubscribe();
      connection.db.layer.removeOnUpdate(onLayerUpdate);
      connection.db.layer.removeOnInsert(onLayerInsert);
      connection.db.layer.removeOnDelete(onLayerDelete);
    };
  }, [connection, projectId]);

  return {
    layers,
    setLayers,
    isLoading,
    error,
    selectedLayer,
    setSelectedLayer,
  };
};
