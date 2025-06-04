import { useCurrentWorld } from "@/contexts/CurrentWorldContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { HexColorPicker } from "react-colorful";
import React from "react";
import "../custom/color-picker.css";
import { FileUp } from "lucide-react";
import { Button } from "../ui/button";

interface ColorPaletteProps {
  worldId: string;
}

export default function ColorPalette({ worldId }: ColorPaletteProps) {
  const { connection } = useDatabase();
  const { palette, player } = useCurrentWorld();

  const selectColor = (index: number) => {
    if (!connection || !worldId) return;
    connection.reducers.selectColorIndex(worldId, index);
  };

  const selectSpecificColor = React.useCallback(
    (color: string) => {
      connection?.reducers.selectColor(worldId, color);
    },
    [connection?.reducers, worldId]
  );

  const { selectedColor, selectedColorIndex } = React.useMemo(() => {
    if (player.selectedColor.startsWith("idx")) {
      const index = parseInt(player.selectedColor.split("idx")[1]);
      return {
        selectedColor: palette.colors[index],
        selectedColorIndex: index,
      };
    } else {
      return {
        selectedColor: player.selectedColor,
        selectedColorIndex: undefined,
      };
    }
  }, [palette.colors, player.selectedColor]);

  if (!palette) return null;

  return (
    <div className="flex flex-col grow justify-between p-2 bg-card border-r border-border">
      <div className="overflow-clip w-min">
        {palette.colors.map((color, index) => (
          <button
            key={index}
            className="relative w-8 h-8 border border-border hover:scale-105 hover:shadow-sm transition-all"
            style={{ backgroundColor: color }}
            onClick={() => selectColor(index)}
            title={`Color ${index + 1}: ${color}`}
          >
            {selectedColorIndex === index && (
              <div className="absolute inset-0 border-1 border-black shadow-md">
                <div className="w-full h-full border-1 border-white shadow-md">
                  <div className="relative w-full h-full border-1 border-black shadow-md">
                    {/* Dog ear in top-left using SVG */}
                    <svg
                      className="absolute top-0 left-0 w-4 h-4"
                      viewBox="0 0 12 12"
                    >
                      <polygon
                        points="0,0 10,0 0,10"
                        fill="white"
                        stroke="black"
                        strokeWidth=".4"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="pb-10">
        <div>
          Selected Color
          <div className="flex flex-row space-x-1">
            <div
              className="rounded grow mb-2 text-center py-1"
              style={{ backgroundColor: selectedColor }}
            >
              {selectedColor}
            </div>
            {selectedColorIndex && selectedColorIndex > 0 ? null : (
              <Button variant="outline" className="w-min h-min">
                <FileUp />
              </Button>
            )}
          </div>
        </div>
        <HexColorPicker color={selectedColor} onChange={selectSpecificColor} />
      </div>
    </div>
  );
}
