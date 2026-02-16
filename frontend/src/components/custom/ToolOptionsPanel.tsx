import type { ToolOption } from "@/modeling/lib/tool-interface";
import { Button } from "@/components/ui/button";
import { DirectionPicker } from "./DirectionPicker";
import type { ShapeDirection } from "@/modeling/lib/tool-type";
import {
  Square,
  Circle,
  Cylinder,
  Triangle,
  Diamond,
  Cone,
  Pyramid,
  Hexagon,
  Star,
  Cross,
  type LucideIcon,
} from "lucide-react";

const fillShapeIcons: Record<string, LucideIcon> = {
  Rect: Square,
  Cube: Square,
  Sphere: Circle,
  Cylinder: Cylinder,
  Triangle: Triangle,
  Diamond: Diamond,
  Cone: Cone,
  Pyramid: Pyramid,
  Hexagon: Hexagon,
  Star: Star,
  Cross: Cross,
};

function isSliderOption(option: ToolOption): boolean {
  return option.type === "slider";
}

function isDirectionOption(option: ToolOption): boolean {
  return option.type === "direction";
}

interface ToolOptionsPanelProps {
  options: ToolOption[];
  onOptionChange: (name: string, value: string) => void;
  cameraTheta?: number;
}

export const ToolOptionsPanel = ({
  options,
  onOptionChange,
  cameraTheta = 0,
}: ToolOptionsPanelProps) => {
  if (options.length === 0) return null;

  const regularOptions = options.filter((o) => !isSliderOption(o) && !isDirectionOption(o));
  const sliderOptions = options.filter((o) => isSliderOption(o));
  const directionOptions = options.filter((o) => isDirectionOption(o));

  return (
    <div className="border-t border-border">
      <div className="w-full flex flex-row justify-between items-center pl-4 pt-4">
        <h2 className="text-lg font-semibold">Tool Options</h2>
      </div>
      <div className="px-4 pb-4">
        {regularOptions.map((option) => (
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
        {sliderOptions.map((option) => (
          <div key={option.name} className="mt-2">
            <div className="text-sm text-muted-foreground mb-2">
              {option.name}: {option.currentValue}
            </div>
            <input
              type="range"
              min={option.min ?? 1}
              max={option.max ?? 10}
              value={Number(option.currentValue)}
              onChange={(e) => onOptionChange(option.name, e.target.value)}
              className="tool-slider w-full"
            />
          </div>
        ))}
        {directionOptions.map((option) => (
          <div key={option.name} className="mt-2">
            <DirectionPicker
              currentDirection={option.currentValue as ShapeDirection}
              cameraTheta={cameraTheta}
              onDirectionChange={(dir) => onOptionChange(option.name, dir)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
