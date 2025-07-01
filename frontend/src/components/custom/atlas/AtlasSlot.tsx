import { useState, useRef, useEffect } from "react";

interface AtlasSlotProps {
  index: number;
  textureData: ImageData | null;
  onClick: (index: number) => void;
}

export const AtlasSlot = ({ index, textureData, onClick }: AtlasSlotProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const displaySize = 48;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = displaySize;
    canvas.height = displaySize;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, displaySize, displaySize);

    if (textureData) {
      const sourceSize = Math.sqrt(textureData.data.length / 4);
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      tempCanvas.width = sourceSize;
      tempCanvas.height = sourceSize;
      tempCtx.putImageData(textureData, 0, 0);

      ctx.drawImage(tempCanvas, 0, 0, displaySize, displaySize);
    }
  }, [textureData, displaySize]);

  return (
    <div
      className={`
        relative cursor-pointer transition-all duration-150
        ${isHovered ? "scale-110 z-10" : "scale-100"}
        hover:shadow-lg border border-black
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(index)}
    >
      <canvas
        ref={canvasRef}
        className="transition-all duration-150 border border-white"
        style={{
          width: `${displaySize}px`,
          height: `${displaySize}px`,
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
};
