import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ObjectRow } from "./ObjectRow";
import type { VoxelObject } from "@/state/types";

interface SortableObjectRowProps {
  object: VoxelObject;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (object: VoxelObject) => void;
  onToggleVisibility: (object: VoxelObject) => void;
  onToggleLocked: (object: VoxelObject) => void;
  onRename: (object: VoxelObject, name: string) => void;
}

export const SortableObjectRow = ({
  object,
  isSelected,
  onSelect,
  onDelete,
  onToggleVisibility,
  onToggleLocked,
  onRename,
}: SortableObjectRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: object.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ObjectRow
        object={object}
        isSelected={isSelected}
        onSelect={onSelect}
        onDelete={onDelete}
        onToggleVisibility={onToggleVisibility}
        onToggleLocked={onToggleLocked}
        onRename={onRename}
        isDragging={isDragging}
      />
    </div>
  );
};
