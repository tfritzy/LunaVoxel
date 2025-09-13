import { HexagonOverlay } from "./HexagonOverlay";
import { Button } from "@/components/ui/button";
import { FileQuestion, Plus } from "lucide-react";
import { useState, useMemo, useCallback, memo } from "react";
import { BlockModal } from "./BlockModal";
import { useBlockTextures } from "@/lib/useBlockTextures";
import { AtlasData } from "@/lib/useAtlas";
import { Block3DPreview } from "./Block3dPreview";

const BLOCK_WIDTH = "3em";
const BLOCK_HEIGHT = "4.1rem";
const HORIZONTAL_OFFSET = "1.44rem";
const VERTICAL_OVERLAP = "-1.63rem";
const HORIZONTAL_GAP = "-1.5rem";

const HexagonGrid = memo(
  ({
    blockCount,
    selectedBlock,
    onSelectBlock,
    onAddNew,
    atlasData,
  }: {
    blockCount: number;
    selectedBlock: number;
    onSelectBlock: (index: number) => void;
    onAddNew: () => void;
    atlasData: AtlasData;
  }) => {
    const { getBlockTexture, isReady } = useBlockTextures(atlasData, 256);

    const rows = useMemo(() => {
      const result = [];
      let currentIndex = 0;
      let rowIndex = 0;
      const totalItems = blockCount + 1;

      while (currentIndex < totalItems) {
        const itemsInRow = rowIndex % 2 === 0 ? 6 : 5;
        const isOddRow = rowIndex % 2 === 1;
        const rowItems = [];

        for (let i = 0; i < itemsInRow && currentIndex < totalItems; i++) {
          if (currentIndex < blockCount) {
            const blockIndex = currentIndex + 1;
            const blockTexture = isReady ? getBlockTexture(currentIndex) : null;

            rowItems.push(
              <div
                key={blockIndex}
                className="relative pointer-events-none"
                style={{
                  width: BLOCK_WIDTH,
                  height: BLOCK_HEIGHT,
                }}
              >
                {blockTexture ? (
                  <img
                    src={blockTexture}
                    alt={`Block ${blockIndex}`}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileQuestion className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}

                <HexagonOverlay
                  isSelected={blockIndex === selectedBlock}
                  onClick={() => onSelectBlock(blockIndex)}
                />
              </div>
            );
          } else {
            rowItems.push(
              <div
                key={`add-${currentIndex}`}
                className="relative rounded-full pointer-events-none"
                style={{
                  width: BLOCK_WIDTH,
                  height: BLOCK_HEIGHT,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-muted-foreground" />
                </div>
                <HexagonOverlay isSelected={false} onClick={onAddNew} />
              </div>
            );
          }
          currentIndex++;
        }

        result.push(
          <div
            key={rowIndex}
            className="flex flex-row -space-x-[2px] pointer-events-none"
            style={{
              transform: isOddRow
                ? `translateX(${HORIZONTAL_OFFSET})`
                : "translateX(0)",
              marginTop: rowIndex === 0 ? "0" : VERTICAL_OVERLAP,
              marginLeft: `-${HORIZONTAL_GAP}`,
            }}
          >
            {rowItems}
          </div>
        );
        rowIndex++;
      }
      return result;
    }, [
      blockCount,
      selectedBlock,
      onSelectBlock,
      onAddNew,
      getBlockTexture,
      isReady,
      atlasData,
    ]);

    return <div className="flex flex-col">{rows}</div>;
  }
);

export const BlockDrawer = ({
  selectedBlock,
  setSelectedBlock,
  atlasData,
}: {
  projectId: string;
  selectedBlock: number;
  setSelectedBlock: (index: number) => void;
  atlasData: AtlasData;
}) => {
  const [editingBlockIndex, setEditingBlockIndex] = useState<
    number | "new" | null
  >(null);

  const handleSelectBlock = useCallback(
    (index: number) => {
      setSelectedBlock(index);
    },
    [setSelectedBlock]
  );

  const handleAddNew = useCallback(() => {
    setEditingBlockIndex("new");
  }, []);

  const faceColors =
    selectedBlock <= atlasData.blockAtlasMappings.length
      ? atlasData.blockAtlasMappings[selectedBlock - 1]
          .map((face) => atlasData.colors[face])
          .map((c) => `#${c.toString(16).padStart(6, "0")}`)
      : null;

  return (
    <div className="h-full bg-background border-r border-border overflow-y-auto overflow-x-hidden p-4 flex flex-col w-80">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Blocks</h2>
      </div>
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <HexagonGrid
            blockCount={atlasData.blockAtlasMappings.length}
            selectedBlock={selectedBlock}
            onSelectBlock={handleSelectBlock}
            onAddNew={handleAddNew}
            atlasData={atlasData}
          />
        </div>
        {faceColors && (
          <div className="">
            <div className="bg-muted/30 rounded-lg border border-border mb-4">
              <div className="h-48 flex items-center justify-center">
                <Block3DPreview faceColors={faceColors} camRadius={4} />
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
            atlasData={atlasData}
          />
        )}
      </div>
    </div>
  );
};
