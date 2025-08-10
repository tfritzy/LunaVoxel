import { SortableLayerRow } from "./SortableLayerRow";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useDatabase } from "@/contexts/DatabaseContext";
import React, { useEffect, useState } from "react";
import { Layer, EventContext } from "@/module_bindings";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { useProjectMeta } from "@/contexts/CurrentProjectContext";

interface LayersSectionProps {
  onSelectLayer?: (layerIndex: number) => void;
}

export const LayersSection = ({ onSelectLayer }: LayersSectionProps) => {
  const { connection } = useDatabase();
  const { project } = useProjectMeta();
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<number>(0);

  // Notify external listener when selection changes
  useEffect(() => {
    if (onSelectLayer) onSelectLayer(selectedLayer);
  }, [selectedLayer, onSelectLayer]);

  // Local layer subscription
  useEffect(() => {
    if (!connection || !project?.id) return;

    const subscription = connection
      .subscriptionBuilder()
      .onApplied(() => {
        const projectLayers = Array.from(connection.db.layer.tableCache.iter())
          .filter((l: Layer) => l.projectId === project.id)
          .sort((a: Layer, b: Layer) => a.index - b.index);
        setLayers(projectLayers);
      })
      .onError((err) => console.error("Layers subscription error:", err))
      .subscribe([`SELECT * FROM layer WHERE ProjectId='${project.id}'`]);

    const onLayerInsert = (_ctx: EventContext, newLayer: Layer) => {
      if (newLayer.projectId === project.id) {
        setLayers((prev) => {
          if (prev.some((l) => l.id === newLayer.id)) return prev;
          setSelectedLayer(newLayer.index);
          return [...prev, newLayer].sort((a, b) => a.index - b.index);
        });
      }
    };
    const onLayerUpdate = (_ctx: EventContext, _old: Layer, updated: Layer) => {
      if (updated.projectId === project.id) {
        setLayers((prev) =>
          prev
            .map((l) => (l.id === updated.id ? updated : l))
            .sort((a, b) => a.index - b.index)
        );
      }
    };
    const onLayerDelete = (_ctx: EventContext, deleted: Layer) => {
      if (deleted.projectId === project.id) {
        setLayers((prev) => prev.filter((l) => l.id !== deleted.id));
      }
    };

    connection.db.layer.onInsert(onLayerInsert);
    connection.db.layer.onUpdate(onLayerUpdate);
    connection.db.layer.onDelete(onLayerDelete);

    return () => {
      subscription.unsubscribe();
      connection.db.layer.removeOnInsert(onLayerInsert);
      connection.db.layer.removeOnUpdate(onLayerUpdate);
      connection.db.layer.removeOnDelete(onLayerDelete);
    };
  }, [connection, project?.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addLayer = React.useCallback(() => {
    connection?.reducers.addLayer(project.id);
  }, [connection?.reducers, project.id]);

  const onDelete = React.useCallback(
    (layer: Layer) => {
      connection?.reducers.deleteLayer(layer.id);
      if (selectedLayer >= layers.length - 1) {
        setSelectedLayer(selectedLayer - 1);
      }
    },
    [connection?.reducers, layers, selectedLayer]
  );

  const toggleVisibility = React.useCallback(
    (layer: Layer) => {
      connection?.reducers.toggleLayerVisibility(layer.id);
    },
    [connection?.reducers]
  );

  const toggleLocked = React.useCallback(
    (layer: Layer) => {
      connection?.reducers.toggleLayerLock(layer.id);
    },
    [connection?.reducers]
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = layers.findIndex((layer) => layer.id === active.id);
        const newIndex = layers.findIndex((layer) => layer.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          const newLayers = arrayMove(layers, oldIndex, newIndex);
          setLayers(newLayers);
          const newOrder = newLayers.map((layer) => layer.id);
          connection?.reducers.reorderLayers(project.id, newOrder);
        }
      }
    },
    [layers, connection?.reducers, project.id]
  );

  const layerIds = layers.map((layer) => layer.id);

  return (
    <div className="">
      <div className="w-full flex flex-row justify-between items-center mb-4 pl-4 pt-4">
        <h2 className="text-lg font-semibold">Layers</h2>
        <Button variant="ghost" onClick={addLayer}>
          <Plus />
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext
          items={layerIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col">
            {layers.map((l) => (
              <SortableLayerRow
                layer={l}
                key={l.id}
                isSelected={selectedLayer === l.index}
                onSelect={() => setSelectedLayer(l.index)}
                onDelete={onDelete}
                onToggleVisibility={toggleVisibility}
                onToggleLocked={toggleLocked}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
