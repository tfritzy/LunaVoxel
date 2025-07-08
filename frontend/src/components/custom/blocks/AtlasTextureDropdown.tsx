import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";

interface AtlasTextureDropdownProps {
  selectedTexture: number;
  onSelect: (textureIndex: number) => void;
  size?: "default" | "small";
}

export const AtlasTextureDropdown = ({
  selectedTexture,
  onSelect,
  size = "default",
}: AtlasTextureDropdownProps) => {
  const { atlas, atlasSlots } = useCurrentProject();
  const [isOpen, setIsOpen] = useState(false);

  const cellSize = size === "small" ? 32 : 48;
  const gridCols = Math.ceil(Math.sqrt(atlas.size));

  const renderTexturePreview = (textureIndex: number, previewSize: number) => {
    const slot = atlasSlots[textureIndex];
    if (!slot?.textureData) {
      return (
        <div
          className="bg-muted border border-border flex items-center justify-center text-xs text-muted-foreground"
          style={{ width: previewSize, height: previewSize }}
        >
          {textureIndex}
        </div>
      );
    }

    const canvas = document.createElement("canvas");
    canvas.width = previewSize;
    canvas.height = previewSize;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = slot.textureData.width;
      tempCanvas.height = slot.textureData.height;
      const tempCtx = tempCanvas.getContext("2d");

      if (tempCtx) {
        tempCtx.putImageData(slot.textureData, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tempCanvas, 0, 0, previewSize, previewSize);
      }
    }

    return (
      <img
        src={canvas.toDataURL()}
        alt={`Texture ${textureIndex}`}
        className="border border-border"
        style={{
          width: previewSize,
          height: previewSize,
          imageRendering: "pixelated",
        }}
      />
    );
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`flex items-center justify-between ${
            size === "small" ? "p-1 h-auto" : "p-2"
          }`}
        >
          <div className="flex items-center gap-2">
            {renderTexturePreview(selectedTexture, size === "small" ? 24 : 32)}
            {size !== "small" && (
              <span className="text-sm">Texture {selectedTexture}</span>
            )}
          </div>
          <ChevronDown className="w-4 h-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 max-h-96 overflow-y-auto">
        <div
          className="grid gap-1 p-2"
          style={{
            gridTemplateColumns: `repeat(${Math.min(gridCols, 8)}, 1fr)`,
          }}
        >
          {Array.from({ length: atlas.size }, (_, index: number) => (
            <DropdownMenuItem
              key={index}
              className={`p-1 cursor-pointer ${
                selectedTexture === index
                  ? "bg-primary/20 border-primary"
                  : "hover:bg-muted"
              }`}
              onClick={() => {
                onSelect(index);
                setIsOpen(false);
              }}
            >
              <div className="flex flex-col items-center gap-1">
                {renderTexturePreview(index, cellSize)}
                <span className="text-xs">{index}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
