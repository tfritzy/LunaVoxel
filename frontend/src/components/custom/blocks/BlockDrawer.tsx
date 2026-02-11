import { HexagonOverlay } from "./HexagonOverlay";
import { Button } from "@/components/ui/button";
import { FileQuestion, Trash2 } from "lucide-react";
import { useState, useMemo, useCallback, memo } from "react";
import { DeleteBlockModal } from "./DeleteBlockModal";
import { useBlockTextures } from "@/lib/useBlockTextures";
import { AtlasData } from "@/lib/useAtlas";
import { ColorPicker } from "@/components/custom/ColorPicker";
import { stateStore } from "@/state/store";

const BLOCK_WIDTH = "3em";
const BLOCK_HEIGHT = "4.1rem";
const HORIZONTAL_OFFSET = "1.44rem";
const VERTICAL_OVERLAP = "-1.63rem";
const HORIZONTAL_GAP = "-1.5rem";
const DEFAULT_DISPLAY_COLOR = "#ffffff";
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const isValidHexColor = (value: string) => HEX_COLOR_RE.test(value);

const HexagonGrid = memo(
  ({
    blockCount,
    selectedBlock,
    onSelectBlock,
    atlasData,
  }: {
    blockCount: number;
    selectedBlock: number;
    onSelectBlock: (index: number) => void;
    atlasData: AtlasData;
  }) => {
    const { getBlockTexture, isReady } = useBlockTextures(atlasData, 256);

    const rows = useMemo(() => {
      const result = [];
      let currentIndex = 0;
      let rowIndex = 0;
      while (currentIndex < blockCount) {
        const itemsInRow = rowIndex % 2 === 0 ? 6 : 5;
        const isOddRow = rowIndex % 2 === 1;
        const rowItems = [];

        for (let i = 0; i < itemsInRow && currentIndex < blockCount; i++) {
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
                onClick={() => onSelectBlock(blockIndex)}
                stroke={blockIndex === selectedBlock}
              />
            </div>
          );
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
      getBlockTexture,
      isReady,
      atlasData,
    ]);

    return <div className="flex flex-col">{rows}</div>;
  }
);

export const BlockDrawer = ({
  projectId,
  selectedBlock,
  setSelectedBlock,
  atlasData,
}: {
  projectId: string;
  selectedBlock: number;
  setSelectedBlock: (index: number) => void;
  atlasData: AtlasData;
}) => {
  const [deletingBlockIndex, setDeletingBlockIndex] = useState<number | null>(
    null
  );

  const handleDelete = useCallback(() => {
    setDeletingBlockIndex(selectedBlock);
  }, [selectedBlock]);

  const faceColors =
    selectedBlock <= atlasData.blockAtlasMappings.length
      ? atlasData.blockAtlasMappings[selectedBlock - 1]
          .map((face) => atlasData.colors[face])
          .map((c) => `#${c.toString(16).padStart(6, "0")}`)
      : null;
  const normalizedFaceColors = useMemo(() => faceColors ?? [], [faceColors]);
  const faceColorCount = normalizedFaceColors.length;
  const uniqueColorCount = useMemo(
    () => new Set(normalizedFaceColors).size,
    [normalizedFaceColors]
  );
  const singleColor =
    faceColorCount > 0 && uniqueColorCount === 1 ? normalizedFaceColors[0] : null;
  const displayColor =
    singleColor && isValidHexColor(singleColor)
      ? singleColor
      : DEFAULT_DISPLAY_COLOR;

  const handleColorChange = useCallback(
    (color: string) => {
      if (faceColorCount === 0 || selectedBlock < 1) return;
      const normalizedColor = color.startsWith("#") ? color : `#${color}`;
      if (!isValidHexColor(normalizedColor)) return;
      const colorValue = parseInt(normalizedColor.slice(1), 16);
      const updatedFaceColors = Array.from(
        { length: faceColorCount },
        () => colorValue
      );
      stateStore.reducers.updateBlock(
        projectId,
        selectedBlock - 1,
        updatedFaceColors
      );
    },
    [faceColorCount, projectId, selectedBlock]
  );

  return (
    <div className="h-full bg-background border-r border-border overflow-y-auto overflow-x-hidden p-4 flex flex-col w-72">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Blocks</h2>
      </div>
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <HexagonGrid
            blockCount={atlasData.blockAtlasMappings.length}
            selectedBlock={selectedBlock}
            onSelectBlock={setSelectedBlock}
            atlasData={atlasData}
          />
        </div>
        {faceColors && (
          <div className="">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <ColorPicker color={displayColor} onChange={handleColorChange} />
            </div>
          </div>
        )}

        {deletingBlockIndex !== null && (
          <DeleteBlockModal
            isOpen={deletingBlockIndex !== null}
            onClose={() => setDeletingBlockIndex(null)}
            blockIndex={deletingBlockIndex}
            atlasData={atlasData}
            projectId={projectId}
          />
        )}
      </div>
    </div>
  );
};
