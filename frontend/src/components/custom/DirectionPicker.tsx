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
          className={`w-9 h-9 p-0 border-2 rounded-none text-xs flex flex-row items-center justify-center gap-0 ${
            currentDirection === "+z" || currentDirection === "-z"
              ? "border-accent"
              : "border-secondary"
          }`}
          title={centerDir === "+z" ? "Switch to -Z" : "Switch to +Z"}
        >
          <div className="flex flex-col items-center leading-none text-[10px]">
            <span className={currentDirection === "+z" ? "text-accent" : "text-muted-foreground"}>+</span>
            <span className={currentDirection === "-z" ? "text-accent" : "text-muted-foreground"}>−</span>
          </div>
          <span className={currentDirection === "+z" || currentDirection === "-z" ? "text-accent" : "text-secondary"}>Z</span>
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
