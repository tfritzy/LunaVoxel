import { useEffect } from "react";
import { Eraser, Paintbrush, PlusSquare, Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FrontendTool } from "@/lib/toolTypes";

interface FloatingToolbarProps {
  currentTool: FrontendTool;
  onToolChange: (tool: FrontendTool) => void;
}

export const FloatingToolbar = ({
  currentTool,
  onToolChange,
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
        case "a":
          onToolChange("build");
          break;
        case "e":
          onToolChange("erase");
          break;
        case "t":
          onToolChange("paint");
          break;
        case "c":
          onToolChange("block-picker");
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToolChange]);

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-center gap-1">
        <Button
          onClick={() => onToolChange("build")}
          className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${
            currentTool === "build"
              ? "border-accent text-accent"
              : "border-secondary text-secondary"
          }`}
          title="Attach Tool (1)"
        >
          <PlusSquare className="min-w-8 min-h-8" />
          <div className="absolute bottom-0.5 right-0.5 text-xs px-1">A</div>
        </Button>
        <Button
          onClick={() => onToolChange("erase")}
          className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${
            currentTool === "erase"
              ? "border-accent text-accent"
              : "border-secondary text-secondary"
          }`}
          title="Erase Tool (2)"
        >
          <Eraser className="min-w-8 min-h-8" />
          <div className="absolute bottom-0.5 right-0.5 text-xs px-1">E</div>
        </Button>
        <Button
          onClick={() => onToolChange("paint")}
          className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${
            currentTool === "paint"
              ? "border-accent text-accent"
              : "border-secondary text-secondary"
          }`}
          title="Paint Tool (3)"
        >
          <Paintbrush className="min-w-8 min-h-8" />
          <div className="absolute bottom-0.5 right-0.5 text-xs px-1">T</div>
        </Button>
        <Button
          onClick={() => onToolChange("block-picker")}
          className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${
            currentTool === "block-picker"
              ? "border-accent text-accent"
              : "border-secondary text-secondary"
          }`}
          title="Block Picker (4)"
        >
          <Pipette className="min-w-8 min-h-8" />
          <div className="absolute bottom-0.5 right-0.5 text-xs px-1">C</div>
        </Button>
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="w-16 h-16 border-2 border-secondary bg-background"
          />
        ))}
      </div>
    </div>
  );
};
