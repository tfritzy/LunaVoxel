import { useEffect } from "react";
import { Eraser, Paintbrush, PlusSquare, Pipette, Wand2, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ToolType } from "@/modeling/lib/tool-type";
import type { BlockModificationMode } from "@/state/types";

interface FloatingToolbarProps {
  currentTool: ToolType;
  currentMode: BlockModificationMode;
  onToolChange: (tool: ToolType) => void;
  onModeChange: (mode: BlockModificationMode) => void;
}

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
          onToolChange("Rect");
          onModeChange({ tag: "Attach" });
          break;
        case "e":
          onToolChange("Rect");
          onModeChange({ tag: "Erase" });
          break;
        case "t":
          onToolChange("Rect");
          onModeChange({ tag: "Paint" });
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

  const isAttachMode = currentTool === "Rect" && currentMode.tag === "Attach";
  const isEraseMode = currentTool === "Rect" && currentMode.tag === "Erase";
  const isPaintMode = currentTool === "Rect" && currentMode.tag === "Paint";

  // TODO: Separate mode selector and tool selector in the UI. Currently, Build/Erase/Paint
  // buttons set both tool (Rect) and mode (Attach/Erase/Paint). In the future, we should
  // have independent mode and tool selectors so users can combine any tool with any mode.
  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50">
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
          onClick={() => {
            onToolChange("Rect");
            onModeChange({ tag: "Attach" });
          }}
          className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${
            isAttachMode
              ? "border-accent text-accent"
              : "border-secondary text-secondary"
          }`}
          title="Attach Mode (A)"
        >
          <PlusSquare className="min-w-8 min-h-8" />
          <div className="absolute bottom-0.5 right-0.5 text-xs px-1">A</div>
        </Button>
        <Button
          onClick={() => {
            onToolChange("Rect");
            onModeChange({ tag: "Erase" });
          }}
          className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${
            isEraseMode
              ? "border-accent text-accent"
              : "border-secondary text-secondary"
          }`}
          title="Erase Mode (E)"
        >
          <Eraser className="min-w-8 min-h-8" />
          <div className="absolute bottom-0.5 right-0.5 text-xs px-1">E</div>
        </Button>
        <Button
          onClick={() => {
            onToolChange("Rect");
            onModeChange({ tag: "Paint" });
          }}
          className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${
            isPaintMode
              ? "border-accent text-accent"
              : "border-secondary text-secondary"
          }`}
          title="Paint Mode (T)"
        >
          <Paintbrush className="min-w-8 min-h-8" />
          <div className="absolute bottom-0.5 right-0.5 text-xs px-1">T</div>
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
        {/* Placeholder slots for future tools */}
        {Array.from({ length: 2 }, (_, i) => (
          <div
            key={i}
            className="w-16 h-16 border-2 border-secondary bg-background"
          />
        ))}
      </div>
    </div>
  );
};
