import { useEffect, type ComponentType } from "react";
import {
  Eraser,
  Paintbrush,
  PlusSquare,
  Pipette,
  Wand2,
  Move,
  RectangleHorizontal,
  Pen,
  type LucideProps,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ToolType } from "@/modeling/lib/tool-type";
import type { BlockModificationMode } from "@/state/types";

interface FloatingToolbarProps {
  currentTool: ToolType;
  currentMode: BlockModificationMode;
  onToolChange: (tool: ToolType) => void;
  onModeChange: (mode: BlockModificationMode) => void;
}

const INACTIVE_LED_COLOR = "hsl(234 13% 31%)";

const modeConfig: {
  tag: BlockModificationMode["tag"];
  label: string;
  shortcut: string;
  color: string;
  glowColor: string;
  icon: ComponentType<LucideProps>;
}[] = [
  {
    tag: "Attach",
    label: "Attach",
    shortcut: "A",
    color: "hsl(115 54% 76%)",
    glowColor: "hsl(115 54% 76% / 0.4)",
    icon: PlusSquare,
  },
  {
    tag: "Paint",
    label: "Paint",
    shortcut: "T",
    color: "hsl(217 92% 76%)",
    glowColor: "hsl(217 92% 76% / 0.4)",
    icon: Paintbrush,
  },
  {
    tag: "Erase",
    label: "Erase",
    shortcut: "E",
    color: "hsl(343 81% 75%)",
    glowColor: "hsl(343 81% 75% / 0.4)",
    icon: Eraser,
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
      if (event.ctrlKey || event.metaKey) {
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
        case "b":
          onToolChange("Brush");
          break;
        case "c":
          onToolChange("BlockPicker");
          break;
        case "s":
          onToolChange("Select");
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToolChange, onModeChange]);

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-end gap-6">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
          {modeConfig.map((mode) => {
            const isActive = currentMode.tag === mode.tag;
            const Icon = mode.icon;
            return (
              <Button
                key={mode.tag}
                onClick={() => onModeChange({ tag: mode.tag })}
                className="relative rounded-none bg-background hover:bg-background w-16 h-16 p-0 border-2 transition-all border-secondary text-secondary"
                style={{
                  borderColor: isActive ? mode.color : undefined,
                  color: isActive ? mode.color : undefined,
                }}
                title={`${mode.label} (${mode.shortcut})`}
              >
                <Icon className="min-w-8 min-h-8" />
                <div
                  className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full transition-all duration-200"
                  style={{
                    background: isActive ? mode.color : INACTIVE_LED_COLOR,
                    boxShadow: isActive
                      ? `0 0 6px 1px ${mode.glowColor}`
                      : "none",
                  }}
                />
                <div className="absolute bottom-0.5 right-0.5 text-xs px-1">
                  {mode.shortcut}
                </div>
              </Button>
            );
          })}
          </div>
          <span className="text-xs text-secondary">Mode</span>
        </div>

        <div className="flex flex-col items-center gap-1">
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
            onClick={() => onToolChange("Brush")}
            className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${
              currentTool === "Brush"
                ? "border-accent text-accent"
                : "border-secondary text-secondary"
            }`}
            title="Brush Tool (B)"
          >
            <Pen className="min-w-8 min-h-8" />
            <div className="absolute bottom-0.5 right-0.5 text-xs px-1">B</div>
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
            onClick={() => onToolChange("Select")}
            className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${
              currentTool === "Select"
                ? "border-accent text-accent"
                : "border-secondary text-secondary"
            }`}
            title="Select (S)"
          >
            <Wand2 className="min-w-8 min-h-8" />
            <div className="absolute bottom-0.5 right-0.5 text-xs px-1">S</div>
          </Button>
          </div>
          <span className="text-xs text-secondary">Tools</span>
        </div>
      </div>
    </div>
  );
};
