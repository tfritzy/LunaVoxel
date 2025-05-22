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
    <div className="w-48 h-full bg-card border-r border-border flex flex-col">
      <div className="flex-1 p-3 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {palette.colors.map((color, index) => (
            <button
              key={index}
              className={`w-8 h-8 rounded-md transition-all ${
                player.selectedColorIndex === index
                  ? "ring-2 ring-foreground scale-110 shadow-md"
                  : "ring-1 ring-border hover:scale-105 hover:shadow-sm"
              }`}
              style={{ backgroundColor: color }}
              onClick={() => selectColor(index)}
              title={`Color ${index + 1}: ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
