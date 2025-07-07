import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { BlockPreview } from "./BlockPreview";
import { HexagonOverlay } from "./HexagonOverlay";

const BLOCK_WIDTH = "4em";
const BLOCK_HEIGHT = "5rem";
const HEXAGON_OFFSET = "2rem";
const VERTICAL_OVERLAP = "-3.5rem";
const HORIZONTAL_GAP = "-1rem";

export const BlockDrawer = () => {
  const { blocks, selectedBlock, setSelectedBlock } = useCurrentProject();

  const createBlockPreview = (index: number) => (
    <div
      className={`relative rounded-full pointer-events-none transition-transform duration-200 ${
        index === selectedBlock ? "-translate-y-2" : ""
      }`}
      key={index}
      style={{
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
      }}
    >
      <BlockPreview key={index} blockIndex={index} size="small" />
      <HexagonOverlay
        isSelected={index === selectedBlock}
        onClick={() => setSelectedBlock(index)}
      />
    </div>
  );

  const rows = [];
  let currentIndex = 0;
  let rowIndex = 0;

  while (currentIndex < blocks.blockFaceAtlasIndexes.length) {
    const itemsInRow = rowIndex % 2 === 0 ? 3 : 2;
    const isOddRow = rowIndex % 2 === 1;
    const rowItems = [];

    for (
      let i = 0;
      i < itemsInRow && currentIndex < blocks.blockFaceAtlasIndexes.length;
      i++
    ) {
      rowItems.push(createBlockPreview(currentIndex));
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

  return (
    <div className="absolute left-0 top-0 h-full bg-background border-r border-border overflow-y-auto p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Blocks</h2>
      </div>
      <div className="flex flex-col">{rows}</div>
    </div>
  );
};
