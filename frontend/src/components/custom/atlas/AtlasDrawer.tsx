import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { Plus } from "lucide-react";
import { JSX, useMemo } from "react";
import { EditAtlasSlotModal } from "./EditAtlasSlotModal";

export const AtlasDrawer = () => {
  const { atlasSlots } = useCurrentProject();

  const entries: JSX.Element[] = useMemo(() => {
    const slots = atlasSlots.map((slot) => (
      <img
        src={slot.blobUrl || ""}
        alt={`Atlas Slot ${slot.index}`}
        key={slot.index}
        className="w-12 h-12 object-cover"
      />
    ));

    slots.push(
      <button>
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
    <div className="absolute right-0 top-0 h-full bg-background border-l border-border overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4 ml-2 mt-4">Texture Atlas</h2>
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

      <EditAtlasSlotModal
        index={0}
        isOpen={true}
        onClose={function (): void {
          throw new Error("Function not implemented.");
        }}
      />
    </div>
  );
};
