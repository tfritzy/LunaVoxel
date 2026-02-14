import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import type { ToolOptions } from "@/modeling/lib/tool-options";
import type { ToolType } from "@/modeling/lib/tool-type";

interface ToolOptionsSectionProps {
  currentTool: ToolType;
  toolOptions: ToolOptions;
  onToolOptionsChange: (toolOptions: ToolOptions) => void;
}

export const ToolOptionsSection = ({
  currentTool,
  toolOptions,
  onToolOptionsChange,
}: ToolOptionsSectionProps) => {
  const renderOptionButtons = (values: string[], selectedValue: string, onChange: (value: string) => void) => (
    <div className="grid grid-cols-2 gap-1">
      {values.map((value) => (
        <Button
          key={value}
          variant="ghost"
          className={`h-8 px-2 text-xs rounded-none border ${
            selectedValue === value
              ? "border-accent text-accent"
              : "border-border text-secondary"
          }`}
          onClick={() => onChange(value)}
        >
          {value}
        </Button>
      ))}
    </div>
  );

  let title = "";
  let content: ReactNode = null;

  if (currentTool === "Rect") {
    title = "Fill Shape";
    content = renderOptionButtons(
      ["Full", "Sphere", "Triangle4", "Cylinder"],
      toolOptions.Rect.fillShape,
      (value) =>
        onToolOptionsChange({
          ...toolOptions,
          Rect: { fillShape: value as ToolOptions["Rect"]["fillShape"] },
        })
    );
  } else if (currentTool === "MoveSelection") {
    title = "Axis Lock";
    content = renderOptionButtons(
      ["Free", "X", "Y", "Z"],
      toolOptions.MoveSelection.axisLock,
      (value) =>
        onToolOptionsChange({
          ...toolOptions,
          MoveSelection: { axisLock: value as ToolOptions["MoveSelection"]["axisLock"] },
        })
    );
  } else if (currentTool === "BlockPicker") {
    title = "Pick Target";
    content = renderOptionButtons(
      ["BlockType", "Color"],
      toolOptions.BlockPicker.pickTarget,
      (value) =>
        onToolOptionsChange({
          ...toolOptions,
          BlockPicker: { pickTarget: value as ToolOptions["BlockPicker"]["pickTarget"] },
        })
    );
  } else if (currentTool === "MagicSelect") {
    title = "Connectivity";
    content = renderOptionButtons(
      ["Faces", "Volume"],
      toolOptions.MagicSelect.connectivity,
      (value) =>
        onToolOptionsChange({
          ...toolOptions,
          MagicSelect: { connectivity: value as ToolOptions["MagicSelect"]["connectivity"] },
        })
    );
  }

  return (
    <div className="border-t border-border p-3">
      <h3 className="text-sm font-semibold mb-2">Tool Options</h3>
      <p className="text-xs text-secondary mb-2">{title}</p>
      {content}
    </div>
  );
};
