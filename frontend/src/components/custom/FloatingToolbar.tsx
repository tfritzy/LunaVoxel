import { Eraser, Hexagon, Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlockModificationMode } from "@/module_bindings";

interface FloatingToolbarProps {
  currentTool: BlockModificationMode;
  onToolChange: (tool: BlockModificationMode) => void;
}

export default function FloatingToolbar({
  currentTool,
  onToolChange,
}: FloatingToolbarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-center backdrop-blur-md backdrop-brightness-80 gap-2 rounded-md px-2 py-2 shadow-lg">
        <Button
          variant={currentTool.tag === "Build" ? "default" : "outline"}
          onClick={() => onToolChange({ tag: "Build" })}
          className="rounded-md p-0"
          title="Build Tool"
        >
          Attach
          <Hexagon className="h-4 w-4" />
        </Button>

        <Button
          variant={currentTool.tag === "Erase" ? "default" : "outline"}
          onClick={() => onToolChange({ tag: "Erase" })}
          className="rounded-md p-0"
          title="Erase Tool"
        >
          Erase
          <Eraser className="h-4 w-4" />
        </Button>

        <Button
          variant={currentTool.tag === "Paint" ? "default" : "outline"}
          onClick={() => onToolChange({ tag: "Paint" })}
          className="rounded-md p-0"
          title="Paint Tool"
        >
          Paint
          <Paintbrush className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
