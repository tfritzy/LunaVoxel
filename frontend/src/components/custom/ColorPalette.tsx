import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { HexColorPicker } from "react-colorful";
import React from "react";
import "../custom/color-picker.css";
import { FileUp } from "lucide-react";
import { Button } from "../ui/button";
import { PaletteDropdown } from "./PaletteDropdown";
import { ColorPalette as ColorPaletteType } from "./colorPalettes";
import { hexToString } from "@/lib/hexToString";

interface ColorPaletteProps {
  projectId: string;
}

const hexToRgb = (hex: number): { r: number; g: number; b: number } | null => {
  if (hex < 0 || hex > 0xffffff) {
    return null;
  }

  // Extract RGB components using bitwise operations
  const r = (hex >> 16) & 0xff; // Right shift 16 bits, mask with 0xFF
  const g = (hex >> 8) & 0xff; // Right shift 8 bits, mask with 0xFF
  const b = hex & 0xff; // Mask with 0xFF

  return { r, g, b };
};

const normalizeAndValidateHexColor = (hex: string): number | null => {
  let normalized = hex.trim();
  if (!normalized.startsWith("#")) {
    normalized = `#${normalized}`;
  }

  let hexValue: string;

  if (/^#([0-9A-Fa-f]{3})$/i.test(normalized)) {
    hexValue = `${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  } else if (/^#([0-9A-Fa-f]{6})$/i.test(normalized)) {
    hexValue = normalized.slice(1);
  } else {
    return null;
  }

  return parseInt(hexValue, 16);
};

export function ColorPalette({ projectId }: ColorPaletteProps) {
  const { connection } = useDatabase();
  const { palette, selectedColor, setSelectedColor } = useCurrentProject();
  const [inputValue, setInputValue] = React.useState<string>("");

  const selectColor = React.useCallback(
    (color: number) => {
      setSelectedColor(color);
    },
    [setSelectedColor]
  );

  const selectColorString = React.useCallback(
    (color: string) => {
      selectColor(parseInt(color));
    },
    [selectColor]
  );

  const addColorToPalette = React.useCallback(
    (color: number) => {
      if (!connection || !projectId) return;
      connection.reducers.addColorToPalette(projectId, color);
    },
    [connection, projectId]
  );

  const replacePalette = React.useCallback(
    (newPalette: ColorPaletteType) => {
      if (!connection || !projectId) return;
      connection.reducers.replacePalette(projectId, newPalette.colors);
    },
    [connection, projectId]
  );

  const isColorDark = React.useMemo(() => {
    const rgb = hexToRgb(selectedColor);
    let dark = false;
    if (rgb) {
      const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
      dark = luminance < 128;
    }

    return dark;
  }, [selectedColor]);

  React.useEffect(() => {
    setInputValue(selectedColor.toString(16));
  }, [selectedColor]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const currentValue = event.target.value;
    setInputValue(currentValue);

    const normalizedColor = normalizeAndValidateHexColor(currentValue);
    if (normalizedColor && normalizedColor !== selectedColor) {
      selectColor(normalizedColor);
    }
  };

  if (!palette) return null;

  return (
    <div className="flex flex-col w-min justify-between p-2 bg-card border-r border-border">
      <div>
        <PaletteDropdown onPaletteSelect={replacePalette} />

        <div className="flex flex-row flex-wrap mb-4">
          {palette.colors.map((color, index) => (
            <button
              key={index}
              className="border border-white/25 relative w-7 h-7 hover:shadow-sm transition-all"
              style={{ backgroundColor: hexToString(color) }}
              onClick={() => selectColor(index)}
              title={`Color ${index + 1}: ${color}`}
            >
              {selectedColor === color && (
                <div className="absolute -inset-0.5 border-1 border-black shadow-md">
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
          <div className="flex flex-row space-x-1">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              className={`w-full rounded shadow-inner text-center py-1 mb-2 border border-input bg-transparent ${
                isColorDark ? "text-primary" : "text-muted"
              }`}
              style={{
                backgroundColor: hexToString(selectedColor),
                caretColor: isColorDark ? "white" : "black",
              }}
              spellCheck="false"
            />
            {selectedColor !== undefined &&
            palette.colors.includes(selectedColor) ? null : (
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
        <HexColorPicker
          color={hexToString(selectedColor)}
          onChange={selectColorString}
        />
      </div>
    </div>
  );
}
