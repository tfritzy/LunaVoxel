import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { VoxelObject } from "@/state/types";
import {
  Eye,
  EyeOff,
  Trash,
  LockKeyhole,
  MoreVertical,
  Pencil,
  UnlockKeyhole,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ObjectRowProps {
  object: VoxelObject;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (object: VoxelObject) => void;
  onToggleVisibility: (object: VoxelObject) => void;
  onToggleLocked: (object: VoxelObject) => void;
  onRename: (object: VoxelObject, name: string) => void;
  isDragging?: boolean;
}

export const ObjectRow = ({
  object,
  isSelected,
  onSelect,
  onDelete,
  onToggleVisibility,
  onToggleLocked,
  onRename,
  isDragging = false,
}: ObjectRowProps) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(object.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(object.name);
  }, [object.name]);

  useEffect(() => {
    if (isRenaming) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isRenaming]);

  const handleDelete = (event: React.MouseEvent) => {
    onDelete(object);
    event.stopPropagation();
  };

  const handleToggleVisibility = (event: React.MouseEvent) => {
    onToggleVisibility(object);
    event.stopPropagation();
  };

  const handleToggleLocked = (event: React.MouseEvent) => {
    onToggleLocked(object);
    event.stopPropagation();
  };

  const stopDragPropagation = (
    event: React.MouseEvent | React.PointerEvent
  ) => {
    event.stopPropagation();
  };

  const commitRename = () => {
    const trimmed = name.trim();
    const nextName = trimmed || object.name;
    if (nextName !== object.name) {
      onRename(object, nextName);
    }
    setIsRenaming(false);
  };

  const startRenaming = (event: React.MouseEvent) => {
    event.stopPropagation();
    setName(object.name);
    setIsRenaming(true);
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
        {object.visible ? (
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
        {object.locked ? (
          <LockKeyhole className="w-4 h-4 text-muted-foreground" />
        ) : (
          <UnlockKeyhole className="w-4 h-4 text-muted-foreground/20" />
        )}
      </button>

      <div className="flex items-center min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              {isRenaming ? (
                <input
                  ref={inputRef}
                  value={name}
                  className="font-medium bg-transparent outline-none border border-border rounded px-1 py-0.5 w-full"
                  onPointerDown={stopDragPropagation}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      commitRename();
                    } else if (event.key === "Escape") {
                      setIsRenaming(false);
                    }
                  }}
                />
              ) : (
                <div
                  className={`
                    font-medium truncate
                    ${
                      object.visible
                        ? "text-foreground"
                        : "text-muted-foreground/70"
                    }
                  `}
                  onDoubleClick={startRenaming}
                >
                  {object.name}
                </div>
              )}
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
            <DropdownMenuItem onClick={startRenaming}>
              <Pencil className="w-4 h-4 mr-2" />
              Rename
            </DropdownMenuItem>
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
