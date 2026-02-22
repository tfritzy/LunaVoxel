import { SortableObjectRow } from "./SortableObjectRow";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import React, { useEffect, useMemo } from "react";
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
  projectId: string;
}

export const ObjectsSection = ({
  projectId,
}: ObjectsSectionProps) => {
  const selectedObject = useGlobalState((state) => state.selectedObject);
  const objects = useGlobalState((state) => state.objects);

  const sortedObjects = useMemo(() => {
    return objects ?? [];
  }, [objects]);

  useEffect(() => {
    if (sortedObjects.length === 0) return;
    if (!stateStore.getState().objects.some(o => o.id === selectedObject)) {
      const fallback = sortedObjects[sortedObjects.length - 1];
      stateStore.reducers.setSelectedObject(fallback.id);
    }
  }, [sortedObjects, selectedObject]);

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
      editHistory.addObjectAdd(added, newObjects.length - 1);
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
      const previousIndex = stateStore.getState().objects.findIndex(o => o.id === obj.id);

      stateStore.reducers.deleteObject(obj.id);
      editHistory.addObjectDelete(obj, previousIndex, chunks);

      if (selectedObject === obj.id) {
        const remaining = stateStore.getState().objects;
        if (remaining.length > 0) {
          const newIdx = Math.min(previousIndex, remaining.length - 1);
          stateStore.reducers.setSelectedObject(remaining[newIdx].id);
        }
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

        if (oldIndex !== -1 && newIndex !== -1) {
          const previousOrder = currentObjects.map((obj) => obj.id);

          const newOrder = arrayMove(currentObjects, oldIndex, newIndex).map((obj) => obj.id);
          stateStore.reducers.reorderObjects(projectId, newOrder);
          editHistory.addObjectReorder(previousOrder, newOrder);
        }
      }
    },
    [projectId, sortedObjects]
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
                isSelected={selectedObject === o.id}
                onSelect={() => stateStore.reducers.setSelectedObject(o.id)}
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
