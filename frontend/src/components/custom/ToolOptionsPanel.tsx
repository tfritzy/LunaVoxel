import type { ToolOption } from "@/modeling/lib/tool-interface";
import { Button } from "@/components/ui/button";
import {
  Square,
  Circle,
  Cylinder,
  Triangle,
  Diamond,
  type LucideIcon,
} from "lucide-react";

const fillShapeIcons: Record<string, LucideIcon> = {
  Rect: Square,
  Sphere: Circle,
  Cylinder: Cylinder,
  Triangle: Triangle,
  Diamond: Diamond,
};

interface ToolOptionsPanelProps {
  options: ToolOption[];
  onOptionChange: (name: string, value: string) => void;
}

export const ToolOptionsPanel = ({
  options,
  onOptionChange,
}: ToolOptionsPanelProps) => {
  if (options.length === 0) return null;

  return (
    <div className="border-t border-border">
      <div className="w-full flex flex-row justify-between items-center mb-2 pl-4 pt-4">
        <h2 className="text-lg font-semibold">Tool Options</h2>
      </div>
      <div className="px-4 pb-4">
        {options.map((option) => (
          <div key={option.name}>
            <div className="text-sm text-muted-foreground mb-2">
              {option.name}
            </div>
            <div className="flex flex-wrap gap-1">
              {option.values.map((value) => {
                const Icon = fillShapeIcons[value];
                return (
                  <Button
                    key={value}
                    variant="ghost"
                    onClick={() => onOptionChange(option.name, value)}
                    className={`w-10 h-10 p-0 border-2 rounded-none ${
                      option.currentValue === value
                        ? "border-accent text-accent"
                        : "border-secondary text-secondary"
                    }`}
                    title={value}
                  >
                    {Icon ? (
                      <Icon className="w-5 h-5" />
                    ) : (
                      <span className="text-xs">{value}</span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
