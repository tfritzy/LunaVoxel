import type { ShapeDirection } from "@/modeling/lib/tool-type";

interface AxisArrowGizmoProps {
  currentDirection: ShapeDirection;
  onDirectionChange: (direction: ShapeDirection) => void;
}

const CX = 75;
const CY = 75;
const STEM_LENGTH = 42;
const HEAD_LENGTH = 9;
const HEAD_WIDTH = 5;
const LABEL_OFFSET = 13;

const AXIS_COLORS = {
  x: "#f38ba8",
  y: "#a6e3a1",
  z: "#89b4fa",
} as const;

const DISABLED_COLOR = "#585b70";

const DIRECTIONS: {
  dir: ShapeDirection;
  screenAngleDeg: number;
  axis: keyof typeof AXIS_COLORS;
  label: string;
}[] = [
  { dir: "+y", screenAngleDeg: -90, axis: "y", label: "+Y" },
  { dir: "-y", screenAngleDeg: 90, axis: "y", label: "−Y" },
  { dir: "+x", screenAngleDeg: 30, axis: "x", label: "+X" },
  { dir: "-x", screenAngleDeg: 210, axis: "x", label: "−X" },
  { dir: "+z", screenAngleDeg: 150, axis: "z", label: "+Z" },
  { dir: "-z", screenAngleDeg: -30, axis: "z", label: "−Z" },
];

export const AxisArrowGizmo = ({
  currentDirection,
  onDirectionChange,
}: AxisArrowGizmoProps) => {
  return (
    <div>
      <div className="text-sm text-muted-foreground mb-2">Direction</div>
      <svg width="150" height="150" viewBox="0 0 150 150">
        <circle cx={CX} cy={CY} r="3" fill="#45475a" />
        {DIRECTIONS.map(({ dir, screenAngleDeg, axis, label }) => {
          const rad = (screenAngleDeg * Math.PI) / 180;
          const dx = Math.cos(rad);
          const dy = Math.sin(rad);

          const stemEndX = CX + dx * STEM_LENGTH;
          const stemEndY = CY + dy * STEM_LENGTH;
          const tipX = CX + dx * (STEM_LENGTH + HEAD_LENGTH);
          const tipY = CY + dy * (STEM_LENGTH + HEAD_LENGTH);

          const perpX = -dy;
          const perpY = dx;
          const base1X = stemEndX + perpX * HEAD_WIDTH;
          const base1Y = stemEndY + perpY * HEAD_WIDTH;
          const base2X = stemEndX - perpX * HEAD_WIDTH;
          const base2Y = stemEndY - perpY * HEAD_WIDTH;

          const labelX = CX + dx * (STEM_LENGTH + HEAD_LENGTH + LABEL_OFFSET);
          const labelY = CY + dy * (STEM_LENGTH + HEAD_LENGTH + LABEL_OFFSET);

          const isSelected = currentDirection === dir;
          const color = isSelected ? AXIS_COLORS[axis] : DISABLED_COLOR;

          return (
            <g
              key={dir}
              onClick={() => onDirectionChange(dir)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDirectionChange(dir);
                }
              }}
              tabIndex={0}
              style={{ cursor: "pointer" }}
              role="button"
              aria-label={`Select ${dir} direction`}
              aria-pressed={isSelected}
            >
              <line
                x1={CX}
                y1={CY}
                x2={stemEndX}
                y2={stemEndY}
                stroke={color}
                strokeWidth="2"
              />
              <polygon
                points={`${tipX},${tipY} ${base1X},${base1Y} ${base2X},${base2Y}`}
                fill={color}
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fontFamily="inherit"
                fill={color}
              >
                {label}
              </text>
              <line
                x1={CX}
                y1={CY}
                x2={tipX}
                y2={tipY}
                stroke="transparent"
                strokeWidth="14"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
