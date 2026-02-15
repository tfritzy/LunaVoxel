export const points = {
  bottom: 101.3,
  bottomLeft: { x: 5.350000000000001, y: 75.74499999999999 },
  bottomRight: { x: 94.175, y: 75.74499999999999 },
  top: -1.2999999999999972,
  topLeft: { x: 5.350000000000001, y: 24.445000000000004 },
  topRight: { x: 94.175, y: 24.445000000000004 },
};

const hexW = points.topRight.x - points.topLeft.x;
const hexH = points.bottom - points.top;
const mapX = (x: number) => ((x - points.topLeft.x) / hexW * 100);
const mapY = (y: number) => ((y - points.top) / hexH * 100);

export const hexViewBox = `${points.topLeft.x} ${points.top} ${hexW} ${hexH}`;

export const hexClipPath = `polygon(${mapX(50)}% ${mapY(points.top)}%, ${mapX(points.topRight.x)}% ${mapY(points.topRight.y)}%, ${mapX(points.bottomRight.x)}% ${mapY(points.bottomRight.y)}%, ${mapX(50)}% ${mapY(points.bottom)}%, ${mapX(points.bottomLeft.x)}% ${mapY(points.bottomLeft.y)}%, ${mapX(points.topLeft.x)}% ${mapY(points.topLeft.y)}%)`;

export const HexagonOverlay = ({
  onClick,
  stroke,
  dashed,
}: {
  onClick: () => void;
  stroke: boolean;
  dashed?: boolean;
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute inset-0 cursor-pointer hover:stroke-primary/10 pointer-events-auto"
        style={{ clipPath: hexClipPath }}
        onMouseDown={onClick}
      />
      {(stroke || dashed) && (
        <svg
          width="100%"
          height="100%"
          viewBox={hexViewBox}
          className="absolute inset-0"
        >
          <polygon
            className="fill-transparent"
            points={`50,${points.top} ${points.topRight.x},${points.topRight.y} ${points.bottomRight.x},${points.bottomRight.y} 50,${points.bottom} ${points.bottomLeft.x},${points.bottomLeft.y} ${points.topLeft.x},${points.topLeft.y}`}
            stroke={dashed ? "currentColor" : "white"}
            strokeWidth={stroke ? 4 : dashed ? 2 : 0}
            strokeDasharray={dashed ? "6 4" : undefined}
          />
        </svg>
      )}
    </div>
  );
};
