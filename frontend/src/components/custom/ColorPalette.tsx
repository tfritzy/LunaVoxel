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

  if (!palette) return;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-card/30 backdrop-blur-sm border-t border-border flex items-center justify-center px-4">
      <div className="flex gap-2 items-center max-w-3xl overflow-x-auto pb-1 px-2">
        {palette.colors.map((color, index) => (
          <button
            key={index}
            className={`w-8 h-8 rounded-md transition-transform ${
              player.selectedColorIndex === index
                ? "ring-2 ring-foreground scale-110"
                : "ring-1 ring-border/50 hover:scale-105"
            }`}
            style={{ backgroundColor: color }}
            onClick={() => selectColor(index)}
            title={`Color ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
