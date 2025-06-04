import { useCurrentWorld } from "@/contexts/CurrentWorldContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { HexColorPicker } from "react-colorful";
import React from "react";
import "../custom/color-picker.css";
import { FileUp } from "lucide-react";
import { Button } from "../ui/button";
import PaletteDropdown from "./PaletteDropdown";
import { ColorPalette as ColorPaletteType } from "@/lib/colorPalettes";

interface ColorPaletteProps {
  worldId: string;
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

const normalizeAndValidateHexColor = (hex: string): string | null => {
  let normalized = hex.trim();
  if (!normalized.startsWith("#")) {
    normalized = `#${normalized}`;
  }

  if (/^#([0-9A-Fa-f]{3})$/i.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
  }
  if (/^#([0-9A-Fa-f]{6})$/i.test(normalized)) {
    return normalized.toLowerCase();
  }
  return null;
};

export default function ColorPalette({ worldId }: ColorPaletteProps) {
  const { connection } = useDatabase();
  const { palette, player } = useCurrentWorld();
  const [inputValue, setInputValue] = React.useState<string>("");

  const selectColor = React.useCallback(
    (index: number) => {
      if (!connection || !worldId) return;
      connection.reducers.selectColorIndex(worldId, index);
    },
    [connection, worldId]
  );

  const addColorToPalette = React.useCallback(
    (color: string) => {
      if (!connection || !worldId) return;
      connection.reducers.addColorToPalette(worldId, color);
    },
    [connection, worldId]
  );

  const selectSpecificColor = React.useCallback(
    (color: string) => {
      connection?.reducers.selectColor(worldId, color);
    },
    [connection?.reducers, worldId]
  );

  const replacePalette = React.useCallback(
    (newPalette: ColorPaletteType) => {
      if (!connection || !worldId) return;
      connection.reducers.replacePalette(worldId, newPalette.colors);
    },
    [connection, worldId]
  );

  const { selectedColor, selectedColorIndex, isColorDark } =
    React.useMemo(() => {
      let colorToTest: string;
      let finalSelectedColorIndex: number | undefined;

      if (player.selectedColor.startsWith("idx")) {
        const index = parseInt(player.selectedColor.split("idx")[1]);
        colorToTest = palette.colors[index];
        finalSelectedColorIndex = index;
      } else {
        colorToTest = player.selectedColor;
        finalSelectedColorIndex = undefined;
      }

      const rgb = hexToRgb(colorToTest);
      let dark = false;
      if (rgb) {
        const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
        dark = luminance < 128;
      }

      return {
        selectedColor: colorToTest,
        selectedColorIndex: finalSelectedColorIndex,
        isColorDark: dark,
      };
    }, [palette.colors, player.selectedColor]);

  React.useEffect(() => {
    setInputValue(selectedColor);
  }, [selectedColor]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const currentValue = event.target.value;
    setInputValue(currentValue);

    const normalizedColor = normalizeAndValidateHexColor(currentValue);
    if (normalizedColor && normalizedColor !== selectedColor) {
      selectSpecificColor(normalizedColor);
    }
  };

  const handleDeleteColor = React.useCallback(() => {
    if (selectedColorIndex !== undefined && connection && worldId) {
      connection.reducers.removeColorFromPalette(worldId, selectedColorIndex);
    }
  }, [connection, worldId, selectedColorIndex]);

  if (!palette) return null;

  return (
    <div
      className="flex flex-col w-min justify-between p-2 bg-card border-r border-border"
      onKeyDown={(e) => {
        if (e.key === "Delete") {
          handleDeleteColor();
        }
      }}
    >
      <div>
        <PaletteDropdown onPaletteSelect={replacePalette} />

        <div className="flex flex-row flex-wrap mb-4">
          {palette.colors.map((color, index) => (
            <button
              key={index}
              className="relative w-7 h-7 border border-border hover:scale-105 hover:shadow-sm transition-all"
              style={{ backgroundColor: color }}
              onClick={() => selectColor(index)}
              title={`Color ${index + 1}: ${color}`}
            >
              {selectedColorIndex === index && (
                <div className="absolute inset-0 border-1 border-black shadow-md">
                  <div className="w-full h-full border-1 border-white shadow-md">
                    <div className="relative w-full h-full border-1 border-black shadow-md">
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
      </div>

      <div className="pb-10">
        <div>
          <p className="text-primary-muted">Selected Color</p>
          <div className="flex flex-row space-x-1">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              className={`w-full rounded shadow-inner text-center py-1 mb-2 border border-input bg-transparent ${
                isColorDark ? "text-primary" : "text-muted"
              }`}
              style={{
                backgroundColor: selectedColor,
                caretColor: isColorDark ? "white" : "black",
              }}
              spellCheck="false"
            />
            {selectedColorIndex !== undefined &&
            palette.colors[selectedColorIndex] === selectedColor ? null : (
              <Button
                aria-label="Add to palette"
                title="Add to palette"
                variant="outline"
                className="h-full"
                onClick={() => addColorToPalette(selectedColor)}
              >
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
