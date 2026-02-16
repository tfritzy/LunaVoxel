import { Button } from "@/components/ui/button";
import type { ShapeDirection } from "@/modeling/lib/tool-type";

interface DirectionPickerProps {
  currentDirection: ShapeDirection;
  cameraTheta: number;
  onDirectionChange: (direction: ShapeDirection) => void;
}

interface ArrowDef {
  direction: ShapeDirection;
  label: string;
  angle: number;
}

const RADIUS = 36;
const CENTER = 50;
const ARROW_LENGTH = 14;

export const DirectionPicker = ({
  currentDirection,
  cameraTheta,
  onDirectionChange,
}: DirectionPickerProps) => {
  const horizontalArrows: ArrowDef[] = [
    { direction: "+z", label: "+Z", angle: 0 },
    { direction: "+x", label: "+X", angle: Math.PI / 2 },
    { direction: "-z", label: "-Z", angle: Math.PI },
    { direction: "-x", label: "-X", angle: -Math.PI / 2 },
  ];

  return (
    <div>
      <div className="text-sm text-muted-foreground mb-2">Direction</div>
      <div className="flex items-center gap-2">
        <div className="relative" style={{ width: 100, height: 100 }}>
          <svg viewBox="0 0 100 100" width={100} height={100}>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS + 2}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              className="text-secondary"
              opacity={0.3}
            />

            {horizontalArrows.map((arrow) => {
              const visualAngle = arrow.angle - cameraTheta;
              const dx = Math.sin(visualAngle);
              const dy = -Math.cos(visualAngle);
              const startX = CENTER + dx * (RADIUS - ARROW_LENGTH);
              const startY = CENTER + dy * (RADIUS - ARROW_LENGTH);
              const endX = CENTER + dx * RADIUS;
              const endY = CENTER + dy * RADIUS;

              const headLen = 4;
              const headAngle = Math.PI / 6;
              const tipAngle = Math.atan2(endY - startY, endX - startX);
              const head1X = endX - headLen * Math.cos(tipAngle - headAngle);
              const head1Y = endY - headLen * Math.sin(tipAngle - headAngle);
              const head2X = endX - headLen * Math.cos(tipAngle + headAngle);
              const head2Y = endY - headLen * Math.sin(tipAngle + headAngle);

              const isSelected = currentDirection === arrow.direction;

              return (
                <g
                  key={arrow.direction}
                  onClick={() => onDirectionChange(arrow.direction)}
                  className="cursor-pointer"
                >
                  <line
                    x1={CENTER + dx * (RADIUS - ARROW_LENGTH - 4)}
                    y1={CENTER + dy * (RADIUS - ARROW_LENGTH - 4)}
                    x2={CENTER + dx * (RADIUS + 4)}
                    y2={CENTER + dy * (RADIUS + 4)}
                    stroke="transparent"
                    strokeWidth={10}
                  />
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke={isSelected ? "var(--accent)" : "currentColor"}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    className={isSelected ? "" : "text-muted-foreground"}
                  />
                  <polyline
                    points={`${head1X},${head1Y} ${endX},${endY} ${head2X},${head2Y}`}
                    fill="none"
                    stroke={isSelected ? "var(--accent)" : "currentColor"}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    className={isSelected ? "" : "text-muted-foreground"}
                  />
                  <text
                    x={CENTER + dx * (RADIUS + 10)}
                    y={CENTER + dy * (RADIUS + 10)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={7}
                    fill={isSelected ? "var(--accent)" : "currentColor"}
                    className={
                      isSelected
                        ? "font-bold"
                        : "text-muted-foreground"
                    }
                  >
                    {arrow.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            onClick={() => onDirectionChange("+y")}
            className={`h-8 px-2 border-2 rounded-none text-xs ${
              currentDirection === "+y"
                ? "border-accent text-accent"
                : "border-secondary text-secondary"
            }`}
          >
            ↑ +Y
          </Button>
          <Button
            variant="ghost"
            onClick={() => onDirectionChange("-y")}
            className={`h-8 px-2 border-2 rounded-none text-xs ${
              currentDirection === "-y"
                ? "border-accent text-accent"
                : "border-secondary text-secondary"
            }`}
          >
            ↓ −Y
          </Button>
        </div>
      </div>
    </div>
  );
};
