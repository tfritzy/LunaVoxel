import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { Plus } from "lucide-react";
import { JSX, useMemo, useState } from "react";
import { EditAtlasSlotModal } from "./EditAtlasSlotModal";

export const AtlasDrawer = () => {
  const [editingSlotIndex, setEditingSlotIndex] = useState<
    number | "new" | null
  >(null);
  const { atlasSlots } = useCurrentProject();

  const entries: JSX.Element[] = useMemo(() => {
    const slots = atlasSlots.map((slot) => (
      <img
        onClick={() => setEditingSlotIndex(slot.index)}
        draggable={false}
        src={slot.blobUrl || ""}
        alt={`Atlas Slot ${slot.index}`}
        key={slot.index}
        className="w-12 h-12 object-cover cursor-pointer hover:brightness-125"
      />
    ));

    slots.push(
      <button
        className="cursor-pointer"
        onClick={() => setEditingSlotIndex("new")}
        key="new"
      >
        <div className="w-12 h-12 bg-muted flex items-center justify-center">
          <span className="text-xs text-muted-foreground">
            <Plus className="w-8 h-8" />
          </span>
        </div>
      </button>
    );

    return slots;
  }, [atlasSlots]);

  return (
    <div className="absolute right-0 top-0 h-full bg-background border-l border-border overflow-y-auto p-4">
      <h2 className="text-lg font-semibold mb-2">Texture Atlas</h2>
      <div className="relative grid grid-cols-4">
        {entries}
        <div className="absolute inset-0 pointer-events-none grid grid-cols-4 border-white/25 border-l-[.5px] border-t-[.5px]">
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
