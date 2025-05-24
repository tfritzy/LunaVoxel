import { useCurrentWorld } from "@/contexts/CurrentWorldContext";
import { useDatabase } from "@/contexts/DatabaseContext";

interface ColorPaletteProps {
  worldId: string;
}

export default function ColorPalette({ worldId }: ColorPaletteProps) {
  const { connection } = useDatabase();
  const { palette, player } = useCurrentWorld();

  const selectColor = (index: number) => {
    if (!connection || !worldId) return;
    connection.reducers.selectColorIndex(worldId, index);
  };

  if (!palette) return null;

  return (
    <div className="w-43 p-1 h-full bg-card border-r border-border flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-wrap">
          {palette.colors.map((color, index) => (
            <button
              key={index}
              className="relative w-8 h-8 border border-border hover:scale-105 hover:shadow-sm transition-all"
              style={{ backgroundColor: color }}
              onClick={() => selectColor(index)}
              title={`Color ${index + 1}: ${color}`}
            >
              {player.selectedColorIndex === index && (
                <div className="absolute inset-0 border-1 border-black shadow-md">
                  <div className="w-full h-full border-1 border-white shadow-md">
                    <div className="relative w-full h-full border-1 border-black shadow-md">
                      {/* Dog ear in top-left using SVG */}
                      <svg
                        className="absolute top-0 left-0 w-4 h-4"
                        viewBox="0 0 12 12"
                      >
                        <polygon
                          points="0,0 10,0 0,10"
                          fill="white"
                          stroke="black"
                          strokeWidth=".4"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
