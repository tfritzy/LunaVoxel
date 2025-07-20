import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Layer } from "@/module_bindings";
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
}

export const LayerRow = ({
  layer,
  isSelected,
  onSelect,
  onDelete,
  onToggleVisibility,
  onToggleLocked,
}: LayerRowProps) => {
  const getLayerName = () => {
    return `Layer ${layer.index}`;
  };

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

  return (
    <div
      className={cn(
        "relative flex border-l-2 items-center py-2 pl-2 rounded-xs text-sm hover:bg-muted cursor-pointer select-none transition-colors",
        isSelected ? "bg-accent/10 border-accent" : "border-muted"
      )}
      onClick={onSelect}
    >
      <button
        className="rounded flex-shrink-0 cursor-pointer"
        onClick={handleToggleVisibility}
      >
        {layer.visible ? (
          <Eye className="w-4 h-4 text-muted-foreground hover:text-accent" />
        ) : (
          <EyeOff className="w-4 h-4 text-muted-foreground/20 hover:text-accent" />
        )}
      </button>

      <button className="px-2 mr-2" onClick={handleToggleLocked}>
        {layer.locked ? (
          <LockKeyhole className="w-4 h-4 text-muted-foreground/20" />
        ) : (
          <UnlockKeyhole className="w-4 h-4 text-muted-foreground" />
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
                {getLayerName()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center ml-2 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
