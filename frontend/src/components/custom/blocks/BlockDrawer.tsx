import { HexagonOverlay, points, hexViewBox } from "./HexagonOverlay";
import { Eraser } from "lucide-react";
import { useMemo, useRef, useCallback, useEffect, memo } from "react";
import { ColorPicker } from "../ColorPicker";
import { stateStore, useGlobalState } from "@/state/store";

const BLOCK_WIDTH = "3em";
const BLOCK_HEIGHT = "4.1rem";
const HORIZONTAL_OFFSET = "1.44rem";
const VERTICAL_OVERLAP = "-1.63rem";
const HORIZONTAL_GAP = "-1.5rem";

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
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-0.5">
          <Eraser className="w-4 h-4 text-muted-foreground" />
          <span className="text-[7px] font-semibold text-muted-foreground uppercase tracking-wider">
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
            viewBox={hexViewBox}
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

const darkenColor = (hex: string, factor: number): string => {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `rgb(${r},${g},${b})`;
};

const cx = 50;
const cy = 50;

const topFace = `50,${points.top} ${points.topRight.x},${points.topRight.y} ${cx},${cy} ${points.topLeft.x},${points.topLeft.y}`;
const rightFace = `${points.topRight.x},${points.topRight.y} ${points.bottomRight.x},${points.bottomRight.y} 50,${points.bottom} ${cx},${cy}`;
const leftFace = `${points.topLeft.x},${points.topLeft.y} ${cx},${cy} 50,${points.bottom} ${points.bottomLeft.x},${points.bottomLeft.y}`;

const ShadedBlock = memo(
  ({ color }: { color: string }) => {
    const top = darkenColor(color, 1.0);
    const right = darkenColor(color, 0.7);
    const left = darkenColor(color, 0.5);

    return (
      <svg
        width="100%"
        height="100%"
        viewBox={hexViewBox}
        className="absolute inset-0"
        preserveAspectRatio="none"
      >
        <polygon points={topFace} fill={top} />
        <polygon points={rightFace} fill={right} />
        <polygon points={leftFace} fill={left} />
      </svg>
    );
  }
);

const HexagonGrid = memo(
  ({
    blockCount,
    selectedBlock,
    onSelectBlock,
    colors,
  }: {
    blockCount: number;
    selectedBlock: number;
    onSelectBlock: (index: number) => void;
    colors: number[];
  }) => {
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
            const color = `#${colors[currentIndex].toString(16).padStart(6, "0")}`;

            rowItems.push(
              <div
                key={blockIndex}
                className="relative pointer-events-none"
                style={{
                  width: BLOCK_WIDTH,
                  height: BLOCK_HEIGHT,
                }}
              >
                <ShadedBlock color={color} />

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
    }, [blockCount, selectedBlock, onSelectBlock, colors]);

    return <div className="flex flex-col">{rows}</div>;
  }
);

export const BlockDrawer = ({
  selectedBlock,
  setSelectedBlock,
}: {
  selectedBlock: number;
  setSelectedBlock: (index: number) => void;
}) => {
  const blocks = useGlobalState((state) => state.blocks);
  const selectedBlockColorIndex = selectedBlock > 0 ? selectedBlock - 1 : -1;
  const selectedBlockColor =
    selectedBlockColorIndex >= 0
      ? `#${blocks.colors[selectedBlockColorIndex].toString(16).padStart(6, "0")}`
      : "#000000";

  const rafRef = useRef<number>(0);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleColorChange = useCallback(
    (color: string) => {
      if (selectedBlockColorIndex < 0) return;
      const colorValue = parseInt(color.replace("#", ""), 16);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        stateStore.reducers.updateBlockColor(selectedBlockColorIndex, colorValue);
      });
    },
    [selectedBlockColorIndex]
  );

  return (
    <div className="h-full bg-background border-r border-border overflow-y-auto overflow-x-hidden p-4 flex flex-col w-80">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Blocks</h2>
      </div>
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <HexagonGrid
            blockCount={blocks.colors.length}
            selectedBlock={selectedBlock}
            onSelectBlock={setSelectedBlock}
            colors={blocks.colors}
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
