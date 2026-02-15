import type { ToolOption } from "@/modeling/lib/tool-interface";
import { Button } from "@/components/ui/button";
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
  FlipHorizontal2,
  FlipVertical2,
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

const flipIcons: Record<string, LucideIcon> = {
  "Flip X": FlipHorizontal2,
  "Flip Y": FlipVertical2,
  "Flip Z": FlipHorizontal2,
};

function isToggleOption(option: ToolOption): boolean {
  return option.values.length === 2 && option.values[0] === "Off" && option.values[1] === "On";
}

function isSliderOption(option: ToolOption): boolean {
  return option.type === "slider";
}

interface ToolOptionsPanelProps {
  options: ToolOption[];
  onOptionChange: (name: string, value: string) => void;
}

export const ToolOptionsPanel = ({
  options,
  onOptionChange,
}: ToolOptionsPanelProps) => {
  if (options.length === 0) return null;

  const regularOptions = options.filter((o) => !isToggleOption(o) && !isSliderOption(o));
  const sliderOptions = options.filter((o) => isSliderOption(o));
  const toggleOptions = options.filter((o) => isToggleOption(o));

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
              className="w-full accent-accent"
            />
          </div>
        ))}
        {toggleOptions.length > 0 && (
          <div className="mt-2">
            <div className="text-sm text-muted-foreground mb-2">
              Flip
            </div>
            <div className="flex flex-wrap gap-1">
              {toggleOptions.map((option) => {
                const Icon = flipIcons[option.name];
                const isOn = option.currentValue === "On";
                return (
                  <Button
                    key={option.name}
                    variant="ghost"
                    onClick={() =>
                      onOptionChange(option.name, isOn ? "Off" : "On")
                    }
                    className={`h-10 px-2 border-2 rounded-none gap-1 ${
                      isOn
                        ? "border-accent text-accent"
                        : "border-secondary text-secondary"
                    }`}
                    title={option.name}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span className="text-xs">{option.name.replace("Flip ", "")}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
