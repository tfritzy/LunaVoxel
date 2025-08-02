import { useEffect } from "react";
import { Hexagon, Eraser, Paintbrush, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlockModificationMode } from "@/module_bindings";

interface FloatingToolbarProps {
  currentTool: BlockModificationMode;
  onToolChange: (tool: BlockModificationMode) => void;
}

export const FloatingToolbar = ({
  currentTool,
  onToolChange,
}: FloatingToolbarProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'a':
          onToolChange({ tag: "Build" });
          break;
        case 'e':
          onToolChange({ tag: "Erase" });
          break;
        case 't':
          onToolChange({ tag: "Paint" });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToolChange]);

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-center gap-1">
        <Button
          onClick={() => onToolChange({ tag: "Build" })}
          className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${currentTool.tag === "Build"
            ? "border-accent text-accent"
            : "border-secondary text-secondary"
            }`}
          title="Attach Tool (A)"
        >
          <PlusSquare className="min-w-8 min-h-8" />
          <div className="absolute bottom-0.5 right-0.5 text-xs px-1">
            A
          </div>
        </Button>

        <Button
          onClick={() => onToolChange({ tag: "Erase" })}
          className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${currentTool.tag === "Erase"
            ? "border-accent text-accent"
            : "border-secondary text-secondary"
            }`}
          title="Erase Tool (E)"
        >
          <Eraser className="min-w-8 min-h-8" />
          <div className="absolute bottom-0.5 right-0.5 text-xs px-1">
            E
          </div>
        </Button>

        <Button
          onClick={() => onToolChange({ tag: "Paint" })}
          className={`relative rounded-none bg-background hover:bg-background hover:border-accent/75 hover:text-accent/75 w-16 h-16 p-0 border-2 transition-all ${currentTool.tag === "Paint"
            ? "border-accent text-accent"
            : "border-secondary text-secondary"
            }`}
          title="Paint Tool (T)"
        >
          <Paintbrush className="min-w-8 min-h-8" />
          <div className="absolute bottom-0.5 right-0.5 text-xs px-1">
            T
          </div>
        </Button>

        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="w-16 h-16 border-2 border-secondary bg-background"
          />
        ))}
      </div>
    </div>
  );
};