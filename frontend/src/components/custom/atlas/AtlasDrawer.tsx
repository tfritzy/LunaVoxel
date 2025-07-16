import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { Plus, Download } from "lucide-react";
import { JSX, useMemo, useState } from "react";
import { EditAtlasSlotModal } from "./EditAtlasSlotModal";

export const AtlasDrawer = () => {
  const [editingSlotIndex, setEditingSlotIndex] = useState<
    number | "new" | null
  >(null);
  const { atlasSlots, atlas, textureAtlas } = useCurrentProject();

  const handleDownload = () => {
    if (!textureAtlas?.image) return;

    const canvas = document.createElement("canvas");
    console.log("AtlasDrawer - Created canvas for downloading texture atlas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const image = textureAtlas.image as HTMLImageElement;
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    const link = document.createElement("a");
    link.download = "texture-atlas.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  const entries: JSX.Element[] = useMemo(() => {
    const slots = atlasSlots.map((slot) => (
      <img
        onClick={() => setEditingSlotIndex(slot.index)}
        draggable={false}
        src={slot.blobUrl || ""}
        alt={`Atlas Slot ${slot.index}`}
        key={slot.index}
        className="w-6 h-6 object-cover cursor-pointer hover:brightness-125"
        style={{ imageRendering: "pixelated" }}
      />
    ));
    slots.push(
      <button
        className="cursor-pointer"
        onClick={() => setEditingSlotIndex("new")}
        key="new"
      >
        <div className="w-6 h-6 bg-muted flex items-center justify-center">
          <span className="text-xs text-muted-foreground">
            <Plus className="w-4 h-4" />
          </span>
        </div>
      </button>
    );
    return slots;
  }, [atlasSlots]);

  return (
    <div className="absolute right-0 top-0 h-full bg-background border-l border-border overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Texture Atlas</h2>
        <button
          onClick={handleDownload}
          disabled={!textureAtlas?.image}
          className="p-2 hover:bg-muted rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          title="Download texture atlas"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Cell size:</span>
          <span className="font-mono">
            {atlas.cellPixelWidth}×{atlas.cellPixelWidth}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Atlas size:</span>
          <span className="font-mono">
            {textureAtlas?.image?.width || 0}×{textureAtlas?.image?.height || 0}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Used slots:</span>
          <span className="font-mono">
            {atlas.usedSlots}/{atlas.gridSize * atlas.gridSize}
          </span>
        </div>
      </div>

      <div className="relative grid grid-cols-8">
        {entries}
        <div className="absolute inset-0 pointer-events-none grid grid-cols-8 border-white/25 border-l-[.5px] border-t-[.5px]">
          {Array.from({ length: entries.length }, (_, i) => (
            <div
              key={i}
              className="border-white/25 border-r-[.5px] border-b-[.5px]"
            />
          ))}
        </div>
      </div>
      {editingSlotIndex !== null && (
        <EditAtlasSlotModal
          index={editingSlotIndex || 0}
          isOpen={editingSlotIndex !== null}
          onClose={() => setEditingSlotIndex(null)}
        />
      )}
    </div>
  );
};
