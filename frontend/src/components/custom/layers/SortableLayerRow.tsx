import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LayerRow } from "./LayerRow";
import { Layer } from "@/module_bindings";

interface SortableLayerRowProps {
  layer: Layer;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (layer: Layer) => void;
  onToggleVisibility: (layer: Layer) => void;
  onToggleLocked: (layer: Layer) => void;
}

export const SortableLayerRow = ({
  layer,
  isSelected,
  onSelect,
  onDelete,
  onToggleVisibility,
  onToggleLocked,
}: SortableLayerRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LayerRow
        layer={layer}
        isSelected={isSelected}
        onSelect={onSelect}
        onDelete={onDelete}
        onToggleVisibility={onToggleVisibility}
        onToggleLocked={onToggleLocked}
        isDragging={isDragging}
      />
    </div>
  );
};
