import { SortableObjectRow } from "./SortableObjectRow";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import type { VoxelObject } from "@/state/types";
import { stateStore, useGlobalState } from "@/state/store";
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
import { editHistory } from "@/state/edit-history-instance";

interface ObjectsSectionProps {
  onSelectObject?: (objectIndex: number) => void;
  projectId: string;
}

export const ObjectsSection = ({
  onSelectObject,
  projectId,
}: ObjectsSectionProps) => {
  const [selectedObject, setSelectedObjectState] = useState<number>(0);
  const objects = useGlobalState((state) => state.objects);

  const sortedObjects = useMemo(() => {
    return objects ? [...objects].sort((a, b) => b.index - a.index) : [];
  }, [objects]);

  const setSelectedObject = React.useCallback(
    (objectIndex: number) => {
      const maxObjectIndex = sortedObjects.length - 1;
      const validObjectIndex =
        maxObjectIndex < 0
          ? 0
          : Math.min(Math.max(objectIndex, 0), maxObjectIndex);
      setSelectedObjectState((current) =>
        current === validObjectIndex ? current : validObjectIndex
      );
    },
    [sortedObjects.length]
  );

  useEffect(() => {
    if (onSelectObject) onSelectObject(selectedObject);
  }, [selectedObject, onSelectObject]);

  useEffect(() => {
    setSelectedObject(selectedObject);
  }, [selectedObject, setSelectedObject]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addObject = React.useCallback(() => {
    stateStore.reducers.addObject(projectId);
    const newObjects = stateStore.getState().objects;
    const added = newObjects[newObjects.length - 1];
    if (added) {
      editHistory.addObjectAdd(added);
    }
  }, [projectId]);

  const onDelete = React.useCallback(
    (obj: VoxelObject) => {
      const chunks = new Map<string, { key: string; minPos: { x: number; y: number; z: number }; size: { x: number; y: number; z: number }; voxels: Uint8Array }>();
      const state = stateStore.getState();
      for (const [key, chunk] of state.chunks.entries()) {
        if (chunk.objectId === obj.id) {
          chunks.set(key, {
            key: chunk.key,
            minPos: { ...chunk.minPos },
            size: { ...chunk.size },
            voxels: new Uint8Array(chunk.voxels),
          });
        }
      }
      const previousIndex = obj.index;

      stateStore.reducers.deleteObject(obj.id);
      editHistory.addObjectDelete(obj, previousIndex, chunks);

      if (selectedObject >= sortedObjects.length - 1) {
        setSelectedObject(Math.max(0, selectedObject - 1));
      }
    },
    [sortedObjects, selectedObject]
  );

  const toggleVisibility = React.useCallback(
    (obj: VoxelObject) => {
      stateStore.reducers.toggleObjectVisibility(obj.id);
    },
    []
  );

  const toggleLocked = React.useCallback(
    (obj: VoxelObject) => {
      stateStore.reducers.toggleObjectLock(obj.id);
    },
    []
  );

  const renameObject = React.useCallback((obj: VoxelObject, name: string) => {
    const previousName = obj.name;
    stateStore.reducers.renameObject(obj.id, name);
    editHistory.addObjectRename(obj.id, previousName, name);
  }, []);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const currentObjects = sortedObjects || [];
        const oldIndex = currentObjects.findIndex(
          (obj) => obj.id === active.id
        );
        const newIndex = currentObjects.findIndex(
          (obj) => obj.id === over.id
        );
        const selectedId = currentObjects[selectedObject].id;

        if (oldIndex !== -1 && newIndex !== -1) {
          const previousOrder = currentObjects.map((obj) => obj.id);

          let newObjects = arrayMove(currentObjects, oldIndex, newIndex);
          newObjects = newObjects.map((o, i) => ({ ...o, index: i }));
          const newSelectedIndex = newObjects.findIndex(
            (o) => o.id === selectedId
          );
          setSelectedObject(newSelectedIndex);

          const newOrder = newObjects.map((obj) => obj.id);
          stateStore.reducers.reorderObjects(projectId, newOrder);
          editHistory.addObjectReorder(previousOrder, newOrder);
        }
      }
    },
    [projectId, selectedObject, sortedObjects]
  );

  const objectIds = sortedObjects.map((obj) => obj.id);

  return (
    <div className="">
      <div className="w-full flex flex-row justify-between items-center mb-4 pl-4 pt-4">
        <h2 className="text-lg font-semibold">Objects</h2>
        <Button variant="ghost" onClick={addObject}>
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
          items={objectIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col">
            {sortedObjects.map((o) => (
              <SortableObjectRow
                object={o}
                key={o.id}
                isSelected={selectedObject === o.index}
                onSelect={() => setSelectedObject(o.index)}
                onDelete={onDelete}
                onToggleVisibility={toggleVisibility}
                onToggleLocked={toggleLocked}
                onRename={renameObject}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
