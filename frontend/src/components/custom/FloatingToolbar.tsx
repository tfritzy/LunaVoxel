import { useEffect } from "react";
import { PlusSquare, Pipette, Wand2, Move, Circle } from "lucide-react";
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
        case "r":
          onToolChange("Rect");
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

  const isAttachMode = currentMode.tag === "Attach";
  const isEraseMode = currentMode.tag === "Erase";
  const isPaintMode = currentMode.tag === "Paint";

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-center gap-3">
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
          <PlusSquare className="min-w-8 min-h-8" />
          <div className="absolute bottom-0.5 right-0.5 text-xs px-1">R</div>
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
        {/* Placeholder slots for future tools */}
        {Array.from({ length: 1 }, (_, i) => (
          <div
            key={i}
            className="w-16 h-16 border-2 border-secondary bg-background"
          />
        ))}
        </div>
        <div className="flex items-center gap-2 rounded-full border-2 border-secondary bg-background px-3 py-2">
          <Button
            onClick={() => onModeChange({ tag: "Attach" })}
            className={`relative rounded-full w-9 h-9 p-0 border-2 transition-all ${
              isAttachMode
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                : "border-secondary bg-background text-secondary hover:border-emerald-400/70 hover:text-emerald-300/80"
            }`}
            title="Attach Mode (A)"
          >
            <div className={`h-3.5 w-3.5 rounded-full ${isAttachMode ? "bg-emerald-300 shadow-[0_0_8px_var(--color-emerald-300)]" : "bg-emerald-600/70"}`} />
          </Button>
          <Button
            onClick={() => onModeChange({ tag: "Erase" })}
            className={`relative rounded-full w-9 h-9 p-0 border-2 transition-all ${
              isEraseMode
                ? "border-rose-400 bg-rose-500/20 text-rose-300"
                : "border-secondary bg-background text-secondary hover:border-rose-400/70 hover:text-rose-300/80"
            }`}
            title="Erase Mode (E)"
          >
            <div className={`h-3.5 w-3.5 rounded-full ${isEraseMode ? "bg-rose-300 shadow-[0_0_8px_var(--color-rose-300)]" : "bg-rose-600/70"}`} />
          </Button>
          <Button
            onClick={() => onModeChange({ tag: "Paint" })}
            className={`relative rounded-full w-9 h-9 p-0 border-2 transition-all ${
              isPaintMode
                ? "border-sky-400 bg-sky-500/20 text-sky-300"
                : "border-secondary bg-background text-secondary hover:border-sky-400/70 hover:text-sky-300/80"
            }`}
            title="Paint Mode (T)"
          >
            <div className={`h-3.5 w-3.5 rounded-full ${isPaintMode ? "bg-sky-300 shadow-[0_0_8px_var(--color-sky-300)]" : "bg-sky-600/70"}`} />
          </Button>
        </div>
      </div>
    </div>
  );
};
