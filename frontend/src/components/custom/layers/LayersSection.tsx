import { SortableLayerRow } from "./SortableLayerRow";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLayers, reducers, type Layer } from "@/state";
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

interface LayersSectionProps {
  onSelectLayer?: (layerIndex: number) => void;
}

export const LayersSection = ({
  onSelectLayer,
}: LayersSectionProps) => {
  const [selectedLayer, setSelectedLayer] = useState<number>(0);
  const layers = useLayers();
  const [optimisticLayers, setOptimisticLayers] = useState<Layer[] | null>(null);

  const sortedLayers = useMemo(() => {
    const layersToUse = optimisticLayers ?? layers;
    return layersToUse ? [...layersToUse].sort((a, b) => b.index - a.index) : [];
  }, [layers, optimisticLayers]);

  useEffect(() => {
    if (optimisticLayers) {
      setOptimisticLayers(null);
    }
  }, [layers]);

  useEffect(() => {
    if (onSelectLayer) onSelectLayer(selectedLayer);
  }, [selectedLayer, onSelectLayer]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addLayer = React.useCallback(() => {
    reducers.addLayer();
  }, []);

  const onDelete = React.useCallback(
    (layer: Layer) => {
      reducers.deleteLayer(layer.id);
      if (selectedLayer >= sortedLayers.length - 1) {
        setSelectedLayer(selectedLayer - 1);
      }
    },
    [sortedLayers, selectedLayer]
  );

  const toggleVisibility = React.useCallback(
    (layer: Layer) => {
      reducers.toggleLayerVisibility(layer.id);
    },
    []
  );

  const toggleLocked = React.useCallback(
    (layer: Layer) => {
      reducers.toggleLayerLock(layer.id);
    },
    []
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const currentLayers = sortedLayers || [];
        const oldIndex = currentLayers.findIndex(
          (layer) => layer.id === active.id
        );
        const newIndex = currentLayers.findIndex(
          (layer) => layer.id === over.id
        );
        const selectedId = currentLayers[selectedLayer].id;

        if (oldIndex !== -1 && newIndex !== -1) {
          let newLayers = arrayMove(currentLayers, oldIndex, newIndex);
          newLayers = newLayers.map((l, i) => ({ ...l, index: i }));
          setOptimisticLayers(newLayers);
          const newSelectedIndex = newLayers.findIndex(
            (l) => l.id === selectedId
          );
          setSelectedLayer(newSelectedIndex);

          const newOrder = newLayers.map((layer) => layer.id);
          reducers.reorderLayers(newOrder);
        }
      }
    },
    [
      selectedLayer,
      sortedLayers,
    ]
  );

  const layerIds = sortedLayers.map((layer) => layer.id);

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
            {sortedLayers.map((l) => (
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
