const points = {
  bottom: 101.3,
  bottomLeft: { x: 5.350000000000001, y: 75.74499999999999 },
  bottomRight: { x: 94.175, y: 75.74499999999999 },
  top: -1.2999999999999972,
  topLeft: { x: 5.350000000000001, y: 24.445000000000004 },
  topRight: { x: 94.175, y: 24.445000000000004 },
};
export const HexagonOverlay = ({
  isSelected,
  onClick,
}: {
  isSelected: boolean;
  onClick: () => void;
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute inset-0 cursor-pointer hover:stroke-primary/10 pointer-events-auto"
        style={{
          clipPath: `polygon(50% ${points.top}%, ${points.topRight.x}% ${points.topRight.y}%, ${points.bottomRight.x}% ${points.bottomRight.y}%, 50% ${points.bottom}%, ${points.bottomLeft.x}% ${points.bottomLeft.y}%, ${points.topLeft.x}% ${points.topLeft.y}%)`,
        }}
        onMouseDown={onClick}
      />
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        className="absolute inset-0"
      >
        <polygon
          className="fill-transparent"
          points={`50,${points.top} ${points.topRight.x},${points.topRight.y} ${points.bottomRight.x},${points.bottomRight.y} 50,${points.bottom} ${points.bottomLeft.x},${points.bottomLeft.y} ${points.topLeft.x},${points.topLeft.y}`}
          stroke={isSelected ? "white" : "#ffffff88"}
          strokeWidth={isSelected ? 1 : 2}
          opacity={isSelected ? 1 : 1}
        />
      </svg>
    </div>
  );
};
