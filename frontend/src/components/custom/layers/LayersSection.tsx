import { SortableLayerRow } from "./SortableLayerRow";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useDatabase } from "@/contexts/DatabaseContext";
import React from "react";
import { Layer } from "@/module_bindings";
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
import {
  useLayersContext,
  useProjectMeta,
} from "@/contexts/CurrentProjectContext";

export const LayersSection = () => {
  const { connection } = useDatabase();
  const { layers, setLayers, selectedLayer, setSelectedLayer } =
    useLayersContext();
  const { project } = useProjectMeta();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
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
    [connection?.reducers, layers, selectedLayer, setSelectedLayer]
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
    [layers, setLayers, connection?.reducers, project.id]
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
