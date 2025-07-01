import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { useState } from "react";
import { AtlasSlot } from "./AtlasSlot";
import { AtlasSlotModal } from "./AtlasSlotModal";

interface AtlasProps {
  projectId: string;
}

export const Atlas = ({ projectId }: AtlasProps) => {
  const { atlas, atlasSlots } = useCurrentProject();
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { setSelectedBlock, selectedBlock } = useCurrentProject();

  const handleSlotClick = (index: number) => {
    setSelectedBlock(index);
  };

  const handleEditClick = (index: number) => {
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

  const slotsPerRow = Math.ceil(Math.sqrt(atlas.size));
  const slotSize = 48;

  return (
    <div className="p-4">
      <div
        className="grid w-fit"
        style={{
          gridTemplateColumns: `repeat(${slotsPerRow}, ${slotSize}px)`,
        }}
      >
        {atlasSlots.map((slot) => (
          <div key={slot.index} className="relative group">
            <AtlasSlot
              index={slot.index}
              textureData={slot.textureData}
              onClick={handleSlotClick}
              isSelected={selectedBlock === slot.index}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditClick(slot.index);
              }}
              className="absolute top-0 right-0 w-5 h-5 bg-blue-500 hover:bg-blue-600 text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 flex items-center justify-center text-xs"
              aria-label="Edit slot"
            >
              ✎
            </button>
          </div>
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
        />
      )}
    </div>
  );
};
