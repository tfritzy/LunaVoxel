import { HexagonOverlay } from "./HexagonOverlay";
import { Button } from "@/components/ui/button";
import { FileQuestion, Plus } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { BlockModal } from "./BlockModal";
import { Texture } from "three";
import { useBlockTextures } from "@/lib/useBlockTextures";

const BLOCK_WIDTH = "3em";
const BLOCK_HEIGHT = "4.1rem";
const HORIZONTAL_OFFSET = "1.44rem";
const VERTICAL_OVERLAP = "-1.63rem";
const HORIZONTAL_GAP = "-1.5rem";

export const BlockDrawer = ({
  selectedBlock,
  setSelectedBlock,
  blockFaceMappings,
  textureAtlas,
}: {
  projectId: string;
  selectedBlock: number;
  setSelectedBlock: (index: number) => void;
  blockFaceMappings: number[][];
  textureAtlas: Texture;
}) => {
  const [editingBlockIndex, setEditingBlockIndex] = useState<
    number | "new" | null
  >(null);

  const { getBlockTexture, isReady } = useBlockTextures(
    textureAtlas,
    blockFaceMappings,
    256
  );

  const createBlockPreview = useCallback(
    (index: number) => {
      const blockTexture = isReady ? getBlockTexture(index - 1) : null;

      return (
        <div
          className="relative pointer-events-none"
          key={index}
          style={{
            width: BLOCK_WIDTH,
            height: BLOCK_HEIGHT,
          }}
        >
          {blockTexture ? (
            <img
              src={blockTexture}
              alt={`Block ${index}`}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileQuestion className="w-6 h-6 text-muted-foreground" />
            </div>
          )}

          <HexagonOverlay
            isSelected={index === selectedBlock}
            onClick={() => setSelectedBlock(index)}
          />
        </div>
      );
    },
    [selectedBlock, setSelectedBlock, getBlockTexture, isReady]
  );

  const createAddNewHex = useCallback(
    (index: number) => (
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
    ),
    [setEditingBlockIndex]
  );

  const memoizedRows = useMemo(() => {
    const rows = [];
    let currentIndex = 0;
    let rowIndex = 0;
    const totalItems = blockFaceMappings.length + 1;

    while (currentIndex < totalItems) {
      const itemsInRow = rowIndex % 2 === 0 ? 6 : 5;
      const isOddRow = rowIndex % 2 === 1;
      const rowItems = [];

      for (let i = 0; i < itemsInRow && currentIndex < totalItems; i++) {
        if (currentIndex < blockFaceMappings.length) {
          rowItems.push(createBlockPreview(currentIndex + 1));
        } else {
          rowItems.push(createAddNewHex(currentIndex));
        }
        currentIndex++;
      }

      rows.push(
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
    return rows;
  }, [blockFaceMappings.length, createBlockPreview, createAddNewHex]);

  const selectedBlockFaces =
    selectedBlock <= blockFaceMappings.length
      ? blockFaceMappings[selectedBlock - 1]
      : null;

  const selectedBlockTexture =
    selectedBlockFaces && isReady ? getBlockTexture(selectedBlock - 1) : null;

  return (
    <div className="h-full bg-background border-r border-border overflow-y-auto overflow-x-hidden p-4 flex flex-col w-80">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Blocks</h2>
      </div>
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex flex-col">{memoizedRows}</div>
        </div>
        {selectedBlockFaces && (
          <div className="">
            <div className="bg-muted/30 rounded-lg border border-border mb-4">
              <div className="h-48 flex items-center justify-center">
                {selectedBlockTexture ? (
                  <img
                    src={selectedBlockTexture}
                    alt={`Block ${selectedBlock} Preview`}
                    className="w-32"
                  />
                ) : (
                  <span className="text-muted-foreground">
                    Loading preview...
                  </span>
                )}
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
            blockFaceMappings={blockFaceMappings}
          />
        )}
      </div>
    </div>
  );
};
