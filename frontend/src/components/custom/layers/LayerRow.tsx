import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Layer } from "@/state";
import {
  Eye,
  EyeOff,
  Trash,
  LockKeyhole,
  MoreVertical,
  UnlockKeyhole,
} from "lucide-react";

interface LayerRowProps {
  layer: Layer;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (layer: Layer) => void;
  onToggleVisibility: (layer: Layer) => void;
  onToggleLocked: (layer: Layer) => void;
  isDragging?: boolean;
}

export const LayerRow = ({
  layer,
  isSelected,
  onSelect,
  onDelete,
  onToggleVisibility,
  onToggleLocked,
  isDragging = false,
}: LayerRowProps) => {
  const handleDelete = (event: React.MouseEvent) => {
    onDelete(layer);
    event.stopPropagation();
  };

  const handleToggleVisibility = (event: React.MouseEvent) => {
    onToggleVisibility(layer);
    event.stopPropagation();
  };

  const handleToggleLocked = (event: React.MouseEvent) => {
    onToggleLocked(layer);
    event.stopPropagation();
  };

  const stopDragPropagation = (
    event: React.MouseEvent | React.PointerEvent
  ) => {
    event.stopPropagation();
  };

  return (
    <div
      className={cn(
        "relative flex border-l-4 items-center py-2 px-1 pl-2 text-sm hover:bg-muted cursor-grab active:cursor-grabbing select-none transition-colors",
        isSelected ? "bg-accent/8 border-accent" : "border-muted",
        isDragging && "scale-105 shadow-lg"
      )}
      onClick={onSelect}
    >
      <button
        className="rounded flex-shrink-0 cursor-pointer p-1.5 bg-accent/5 mr-1"
        onClick={handleToggleVisibility}
        onPointerDown={stopDragPropagation}
      >
        {layer.visible ? (
          <Eye className="w-4 h-4 text-muted-foreground hover:text-accent" />
        ) : (
          <EyeOff className="w-4 h-4 text-muted-foreground/20 hover:text-accent" />
        )}
      </button>

      <button
        className="px-2 mr-2 cursor-pointer p-1.5 bg-accent/5 rounded"
        onClick={handleToggleLocked}
        onPointerDown={stopDragPropagation}
      >
        {layer.locked ? (
          <LockKeyhole className="w-4 h-4 text-muted-foreground" />
        ) : (
          <UnlockKeyhole className="w-4 h-4 text-muted-foreground/20" />
        )}
      </button>

      <div className="flex items-center min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div
                className={`
                  font-medium truncate
                  ${
                    layer.visible
                      ? "text-foreground"
                      : "text-muted-foreground/70"
                  }
                `}
              >
                {layer.name}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center ml-2 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onPointerDown={stopDragPropagation}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDelete} className="">
              <Trash className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
