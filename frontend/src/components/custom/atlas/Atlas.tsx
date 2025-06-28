import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { useState } from "react";
import { AtlasSlot } from "./AtlasSlot";
import { AtlasSlotModal } from "../AtlasSlotModal";

interface AtlasProps {
  projectId: string;
}

export const Atlas = ({ projectId }: AtlasProps) => {
  const { atlas, atlasSlots } = useCurrentProject();
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  console.log(atlasSlots);

  const handleSlotClick = (index: number) => {
    setSelectedSlotIndex(index);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedSlotIndex(null);
  };

  if (!atlas) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-gray-600 text-center">
          No atlas found for this project
        </div>
      </div>
    );
  }

  const slotsPerRow = Math.ceil(Math.sqrt(atlas.colors.length));
  const slotSize = 48;

  return (
    <div className="p-4">
      <div
        className="grid gap-2 w-fit"
        style={{
          gridTemplateColumns: `repeat(${slotsPerRow}, ${slotSize}px)`,
        }}
      >
        {atlasSlots.map((slot) => (
          <AtlasSlot
            key={slot.index}
            index={slot.index}
            textureData={slot.textureData}
            tint={slot.tint}
            onClick={handleSlotClick}
          />
        ))}
      </div>

      {selectedSlotIndex !== null && (
        <AtlasSlotModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          projectId={projectId}
          index={selectedSlotIndex}
          cellSize={atlas.cellSize}
          defaultTexture={atlasSlots[selectedSlotIndex].textureData}
          defaultTint={atlasSlots[selectedSlotIndex].tint}
        />
      )}
    </div>
  );
};
