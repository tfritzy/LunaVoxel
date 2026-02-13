import { HexagonOverlay, points } from "./HexagonOverlay";
import { FileQuestion } from "lucide-react";
import { useMemo, memo } from "react";
import { useBlockTextures } from "@/lib/useBlockTextures";
import { AtlasData } from "@/lib/useAtlas";
import { ColorPicker } from "../ColorPicker";
import { stateStore, useGlobalState } from "@/state/store";

const BLOCK_WIDTH = "3em";
const BLOCK_HEIGHT = "4.1rem";
const HORIZONTAL_OFFSET = "1.44rem";
const VERTICAL_OVERLAP = "-1.63rem";
const HORIZONTAL_GAP = "-1.5rem";

const EraserVoxelShape = () => {
  return (
    <svg
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-10"
      viewBox="0 0 32 40"
      fill="none"
    >
      <path
        d="M16 2 L28 10 L28 26 L16 34 L4 26 L4 10 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 2"
        className="text-muted-foreground"
      />
      <path
        d="M4 10 L16 18 L28 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 2"
        className="text-muted-foreground/60"
      />
      <path
        d="M16 18 L16 34"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 2"
        className="text-muted-foreground/60"
      />
    </svg>
  );
};

const EraserBlock = memo(
  ({
    isSelected,
    onSelect,
  }: {
    isSelected: boolean;
    onSelect: () => void;
  }) => {
    return (
      <div
        className="relative pointer-events-none"
        style={{
          width: BLOCK_WIDTH,
          height: BLOCK_HEIGHT,
        }}
      >
        <div className="w-full h-full flex items-center justify-center">
          <EraserVoxelShape />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
            Erase
          </span>
        </div>
        <div className="absolute inset-0 pointer-events-none text-muted-foreground">
          <div
            className="absolute inset-0 cursor-pointer pointer-events-auto"
            style={{
              clipPath: `polygon(50% ${points.top}%, ${points.topRight.x}% ${points.topRight.y}%, ${points.bottomRight.x}% ${points.bottomRight.y}%, 50% ${points.bottom}%, ${points.bottomLeft.x}% ${points.bottomLeft.y}%, ${points.topLeft.x}% ${points.topLeft.y}%)`,
            }}
            onMouseDown={onSelect}
          />
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            className="absolute inset-0"
          >
            <polygon
              className="fill-transparent"
              points={`50,${points.top} ${points.topRight.x},${points.topRight.y} ${points.bottomRight.x},${points.bottomRight.y} 50,${points.bottom} ${points.bottomLeft.x},${points.bottomLeft.y} ${points.topLeft.x},${points.topLeft.y}`}
              stroke={isSelected ? "white" : "currentColor"}
              strokeWidth={isSelected ? 4 : 2}
              strokeDasharray={isSelected ? undefined : "6 4"}
            />
          </svg>
        </div>
      </div>
    );
  }
);

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
      let currentIndex = -1;
      let rowIndex = 0;

      const totalItems = blockCount + 1;

      while (currentIndex < totalItems - 1) {
        const itemsInRow = rowIndex % 2 === 0 ? 6 : 5;
        const isOddRow = rowIndex % 2 === 1;
        const rowItems = [];

        for (let i = 0; i < itemsInRow && currentIndex < totalItems - 1; i++) {
          if (currentIndex === -1) {
            rowItems.push(
              <EraserBlock
                key="eraser"
                isSelected={selectedBlock === 0}
                onSelect={() => onSelectBlock(0)}
              />
            );
            currentIndex++;
          } else {
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
  selectedBlock,
  setSelectedBlock,
  atlasData,
}: {
  selectedBlock: number;
  setSelectedBlock: (index: number) => void;
  atlasData: AtlasData;
}) => {
  const blocks = useGlobalState((state) => state.blocks);
  const selectedBlockColorIndex = selectedBlock > 0 ? selectedBlock - 1 : -1;
  const selectedBlockColor =
    selectedBlockColorIndex >= 0
      ? `#${blocks.colors[selectedBlockColorIndex].toString(16).padStart(6, "0")}`
      : "#000000";

  const handleColorChange = (color: string) => {
    if (selectedBlockColorIndex >= 0) {
      const colorValue = parseInt(color.replace("#", ""), 16);
      stateStore.reducers.updateBlockColor(selectedBlockColorIndex, colorValue);
    }
  };

  return (
    <div className="h-full bg-background border-r border-border overflow-y-auto overflow-x-hidden p-4 flex flex-col w-80">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Blocks</h2>
      </div>
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <HexagonGrid
            blockCount={atlasData.blockAtlasMapping.length}
            selectedBlock={selectedBlock}
            onSelectBlock={setSelectedBlock}
            atlasData={atlasData}
          />
        </div>
        {selectedBlock > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="text-sm font-medium mb-2">Block Color</h3>
            <ColorPicker color={selectedBlockColor} onChange={handleColorChange} />
          </div>
        )}
      </div>
    </div>
  );
};
