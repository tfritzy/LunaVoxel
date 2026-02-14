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
      <div className="w-full flex flex-row justify-between items-center pl-4 pt-2">
        <h3 className="text-sm font-semibold">Tool Options</h3>
      </div>
      <div className="px-4 pb-2">
        {options.map((option) => (
          <div key={option.name}>
            <div className="text-xs text-muted-foreground mb-1">
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
                    className={`w-8 h-8 p-0 border-2 rounded-none ${
                      option.currentValue === value
                        ? "border-accent text-accent"
                        : "border-secondary text-secondary"
                    }`}
                    title={value}
                  >
                    {Icon ? (
                      <Icon className="w-4 h-4" />
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
