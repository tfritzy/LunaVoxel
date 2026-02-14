import { useEffect } from "react";
import { Pipette, Wand2, Move, Circle, RectangleHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ToolType } from "@/modeling/lib/tool-type";
import type { BlockModificationMode } from "@/state/types";

interface FloatingToolbarProps {
  currentTool: ToolType;
  currentMode: BlockModificationMode;
  onToolChange: (tool: ToolType) => void;
  onModeChange: (mode: BlockModificationMode) => void;
}

const INACTIVE_COLOR = "hsl(234 13% 31%)";
const INACTIVE_TEXT_COLOR = "hsl(228 24% 72%)";

const modeConfig: {
  tag: BlockModificationMode["tag"];
  label: string;
  shortcut: string;
  color: string;
  glowColor: string;
  bgColor: string;
}[] = [
  {
    tag: "Attach",
    label: "Attach",
    shortcut: "A",
    color: "hsl(115 54% 76%)",
    glowColor: "hsl(115 54% 76% / 0.5)",
    bgColor: "hsl(115 54% 76% / 0.12)",
  },
  {
    tag: "Paint",
    label: "Paint",
    shortcut: "T",
    color: "hsl(217 92% 76%)",
    glowColor: "hsl(217 92% 76% / 0.5)",
    bgColor: "hsl(217 92% 76% / 0.12)",
  },
  {
    tag: "Erase",
    label: "Erase",
    shortcut: "E",
    color: "hsl(343 81% 75%)",
    glowColor: "hsl(343 81% 75% / 0.5)",
    bgColor: "hsl(343 81% 75% / 0.12)",
  },
];

export const FloatingToolbar = ({
  currentTool,
  currentMode,
  onToolChange,
  onModeChange,
}: FloatingToolbarProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      switch (event.key) {
        case "m":
          onToolChange("MoveSelection");
          break;
        case "a":
          onModeChange({ tag: "Attach" });
          break;
        case "e":
          onModeChange({ tag: "Erase" });
          break;
        case "t":
          onModeChange({ tag: "Paint" });
          break;
        case "r":
          onToolChange("Rect");
          break;
        case "c":
          onToolChange("BlockPicker");
          break;
        case "s":
          onToolChange("MagicSelect");
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToolChange, onModeChange]);

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 bg-background/80 border border-secondary rounded-full px-3 py-2 backdrop-blur-sm">
          {modeConfig.map((mode) => {
            const isActive = currentMode.tag === mode.tag;
            return (
              <button
                key={mode.tag}
                onClick={() => onModeChange({ tag: mode.tag })}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full transition-all cursor-pointer"
                title={`${mode.label} (${mode.shortcut})`}
                style={{
                  background: isActive ? mode.bgColor : "transparent",
                }}
              >
                <div
                  className="w-3 h-3 rounded-full transition-all duration-200"
                  style={{
                    background: isActive ? mode.color : INACTIVE_COLOR,
                    boxShadow: isActive
                      ? `0 0 8px 2px ${mode.glowColor}, 0 0 2px 1px ${mode.glowColor}`
                      : "none",
                  }}
                />
                <span
                  className="text-xs font-medium tracking-wide select-none transition-colors duration-200"
                  style={{
                    color: isActive ? mode.color : INACTIVE_TEXT_COLOR,
                  }}
                >
                  {mode.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <Button
            onClick={() => onToolChange("MoveSelection")}
            className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${
              currentTool === "MoveSelection"
                ? "border-accent text-accent"
                : "border-secondary text-secondary"
            }`}
            title="Move Selection (M)"
          >
            <Move className="min-w-8 min-h-8" />
            <div className="absolute bottom-0.5 right-0.5 text-xs px-1">M</div>
          </Button>
          <Button
            onClick={() => onToolChange("Rect")}
            className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${
              currentTool === "Rect"
                ? "border-accent text-accent"
                : "border-secondary text-secondary"
            }`}
            title="Rect Tool (R)"
          >
            <RectangleHorizontal className="min-w-8 min-h-8" />
            <div className="absolute bottom-0.5 right-0.5 text-xs px-1">R</div>
          </Button>
          <Button
            onClick={() => onToolChange("Sphere")}
            className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${
              currentTool === "Sphere"
                ? "border-accent text-accent"
                : "border-secondary text-secondary"
            }`}
            title="Sphere Tool"
          >
            <Circle className="min-w-8 min-h-8" />
          </Button>
          <Button
            onClick={() => onToolChange("BlockPicker")}
            className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${
              currentTool === "BlockPicker"
                ? "border-accent text-accent"
                : "border-secondary text-secondary"
            }`}
            title="Block Picker (C)"
          >
            <Pipette className="min-w-8 min-h-8" />
            <div className="absolute bottom-0.5 right-0.5 text-xs px-1">C</div>
          </Button>
          <Button
            onClick={() => onToolChange("MagicSelect")}
            className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${
              currentTool === "MagicSelect"
                ? "border-accent text-accent"
                : "border-secondary text-secondary"
            }`}
            title="Magic Select (S)"
          >
            <Wand2 className="min-w-8 min-h-8" />
            <div className="absolute bottom-0.5 right-0.5 text-xs px-1">S</div>
          </Button>
        </div>
      </div>
    </div>
  );
};
