import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { BlockPreview } from "./BlockPreview";
import { HexagonOverlay } from "./HexagonOverlay";
import { BlockFacePreview } from "./BlockFacePreview";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { BlockModal } from "./BlockModal";

const BLOCK_WIDTH = "3.75em";
const BLOCK_HEIGHT = "5rem";
const HEXAGON_OFFSET = "1.875rem";
const VERTICAL_OVERLAP = "-1.75rem";
const HORIZONTAL_GAP = "-1.5rem";

export const BlockDrawer = () => {
  const { blocks, selectedBlock, setSelectedBlock } = useCurrentProject();
  const [editingBlockIndex, setEditingBlockIndex] = useState<
    number | "new" | null
  >(null);

  const createBlockPreview = (index: number) => (
    <div
      className="relative rounded-full pointer-events-none"
      key={index}
      style={{
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
      }}
    >
      <BlockPreview key={index} blockIndex={index - 1} />
      <HexagonOverlay
        isSelected={index === selectedBlock}
        onClick={() => setSelectedBlock(index)}
      />
    </div>
  );

  const createAddNewHex = (index: number) => (
    <div
      className="relative rounded-full pointer-events-none"
      key={`add-${index}`}
      style={{
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <Plus className="w-6 h-6 text-muted-foreground" />
      </div>
      <HexagonOverlay
        isSelected={false}
        onClick={() => {
          setEditingBlockIndex("new");
        }}
      />
    </div>
  );

  const rows = [];
  let currentIndex = 0;
  let rowIndex = 0;
  const totalItems = blocks.blockFaceAtlasIndexes.length + 1; // +1 for the add new hex

  while (currentIndex < totalItems) {
    const itemsInRow = rowIndex % 2 === 0 ? 5 : 4;
    const isOddRow = rowIndex % 2 === 1;
    const rowItems = [];

    for (let i = 0; i < itemsInRow && currentIndex < totalItems; i++) {
      if (currentIndex < blocks.blockFaceAtlasIndexes.length) {
        rowItems.push(createBlockPreview(currentIndex + 1));
      } else {
        rowItems.push(createAddNewHex(currentIndex));
      }
      currentIndex++;
    }

    rows.push(
      <div
        key={rowIndex}
        className="flex relative pointer-events-none"
        style={{
          transform: isOddRow
            ? `translateX(${HEXAGON_OFFSET})`
            : "translateX(0)",
          marginTop: rowIndex === 0 ? "0" : VERTICAL_OVERLAP,
          marginLeft: `-${HORIZONTAL_GAP}`,
          zIndex: rowIndex,
        }}
      >
        {rowItems}
      </div>
    );
    rowIndex++;
  }

  const selectedBlockFaces =
    selectedBlock < blocks.blockFaceAtlasIndexes.length
      ? blocks.blockFaceAtlasIndexes[selectedBlock]
      : null;

  return (
    <div className="absolute left-0 top-0 h-full bg-background border-r border-border overflow-y-auto overflow-x-hidden p-4 flex flex-col">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Blocks</h2>
      </div>
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex flex-col">{rows}</div>
        </div>
        {selectedBlockFaces && (
          <div className="">
            <div className="bg-muted/30 rounded-lg border border-border mb-4">
              <div className="h-48 flex items-center justify-center">
                <BlockFacePreview
                  faces={selectedBlockFaces}
                  showLabels={false}
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setEditingBlockIndex(selectedBlock);
              }}
            >
              Edit Block
            </Button>
          </div>
        )}

        {editingBlockIndex !== null && (
          <BlockModal
            isOpen={editingBlockIndex !== null}
            onClose={() => setEditingBlockIndex(null)}
            blockIndex={editingBlockIndex}
          />
        )}
      </div>
    </div>
  );
};
