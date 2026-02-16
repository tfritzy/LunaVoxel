import { Button } from "@/components/ui/button";
import type { ShapeDirection } from "@/modeling/lib/tool-type";

interface DirectionPickerProps {
  currentDirection: ShapeDirection;
  onDirectionChange: (direction: ShapeDirection) => void;
}

const btnClass = (isSelected: boolean) =>
  `w-9 h-9 p-0 border-2 rounded-none text-xs ${
    isSelected ? "border-accent text-accent" : "border-secondary text-secondary"
  }`;

export const DirectionPicker = ({
  currentDirection,
  onDirectionChange,
}: DirectionPickerProps) => {
  const centerDir: ShapeDirection =
    currentDirection === "-z" ? "-z" : "+z";

  return (
    <div>
      <div className="text-sm text-muted-foreground mb-2">Direction</div>
      <div className="grid grid-cols-3 gap-1 w-fit">
        <div />
        <Button
          variant="ghost"
          onClick={() => onDirectionChange("+y")}
          className={btnClass(currentDirection === "+y")}
          title="+Y"
        >
          +Y
        </Button>
        <div />

        <Button
          variant="ghost"
          onClick={() => onDirectionChange("-x")}
          className={btnClass(currentDirection === "-x")}
          title="-X"
        >
          −X
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            onDirectionChange(centerDir === "+z" ? "-z" : "+z")
          }
          className={`w-9 h-9 p-0 border-2 rounded-none text-[10px] leading-tight flex flex-col items-center justify-center ${
            currentDirection === "+z" || currentDirection === "-z"
              ? "border-accent"
              : "border-secondary"
          }`}
          title={centerDir === "+z" ? "Switch to -Z" : "Switch to +Z"}
        >
          <span className={currentDirection === "+z" ? "text-accent" : "text-muted-foreground"}>+Z</span>
          <span className={currentDirection === "-z" ? "text-accent" : "text-muted-foreground"}>−Z</span>
        </Button>
        <Button
          variant="ghost"
          onClick={() => onDirectionChange("+x")}
          className={btnClass(currentDirection === "+x")}
          title="+X"
        >
          +X
        </Button>

        <div />
        <Button
          variant="ghost"
          onClick={() => onDirectionChange("-y")}
          className={btnClass(currentDirection === "-y")}
          title="-Y"
        >
          −Y
        </Button>
        <div />
      </div>
    </div>
  );
};
