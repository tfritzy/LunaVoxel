import { AxisArrowGizmo } from "./AxisArrowGizmo";
import type { ShapeDirection } from "@/modeling/lib/tool-type";

interface DirectionPickerProps {
  currentDirection: ShapeDirection;
  onDirectionChange: (direction: ShapeDirection) => void;
}

export const DirectionPicker = ({
  currentDirection,
  onDirectionChange,
}: DirectionPickerProps) => {
  return (
    <AxisArrowGizmo
      currentDirection={currentDirection}
      onDirectionChange={onDirectionChange}
    />
  );
};
