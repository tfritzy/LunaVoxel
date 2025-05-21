import { useState, useEffect } from "react";
import { useDatabase } from "@/contexts/DatabaseContext";
import { EventContext, Palette, PlayerInWorld } from "@/module_bindings";

interface ColorPaletteProps {
  worldId: string;
}

export default function ColorPalette({ worldId }: ColorPaletteProps) {
  const { connection } = useDatabase();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [playerState, setPlayerState] = useState<PlayerInWorld | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!connection || !worldId) return;

    const playerId = `${connection.identity?.toHexString()}_${worldId}`;

    const onPaletteUpdate = (ctx: EventContext, newPalette: Palette) => {
      if (newPalette.world === worldId) {
        setPalette(newPalette);
      }
    };

    const onPlayerInWorldUpdate = (
      ctx: EventContext,
      oldPlayer: PlayerInWorld,
      newPlayer: PlayerInWorld
    ) => {
      if (newPlayer.id === playerId) {
        setPlayerState(newPlayer);
      }
    };

    const onPlayerInWorldInsert = (
      ctx: EventContext,
      newPlayer: PlayerInWorld
    ) => {
      if (newPlayer.id === playerId) {
        setPlayerState(newPlayer);
      }
    };

    connection.db.palette.onInsert(onPaletteUpdate);
    connection.db.palette.onUpdate(onPaletteUpdate);
    connection.db.playerInWorld.onInsert(onPlayerInWorldInsert);
    connection.db.playerInWorld.onUpdate(onPlayerInWorldUpdate);

    const currentPalette = connection.db.palette.world.find(worldId);
    if (currentPalette) {
      console.log("Query palette and set to", currentPalette);
      setPalette(currentPalette);
    }

    const currentPlayer = connection.db.playerInWorld.id.find(playerId);
    if (currentPlayer) {
      setPlayerState(currentPlayer);
    }

    const sub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        setLoading(false);
      })
      .onError((err) => {
        console.error("Error subscribing to palette:", err);
        setLoading(false);
      })
      .subscribe([
        `SELECT * FROM ColorPalette WHERE World='${worldId}'`,
        `SELECT * FROM PlayerInWorld WHERE Id='${playerId}'`,
      ]);

    return () => {
      sub.unsubscribe();
      connection.db.palette.removeOnInsert(onPaletteUpdate);
      connection.db.palette.removeOnUpdate(onPaletteUpdate);
      connection.db.playerInWorld.removeOnInsert(onPlayerInWorldInsert);
      connection.db.playerInWorld.removeOnUpdate(onPlayerInWorldUpdate);
    };
  }, [connection, worldId]);

  const selectColor = (index: number) => {
    if (!connection || !worldId) return;
    connection.reducers.selectColorIndex(worldId, index);
  };

  if (loading || !palette) {
    return (
      <div className="h-12 bg-card/30 border-t border-border animate-pulse"></div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-card/30 backdrop-blur-sm border-t border-border flex items-center justify-center px-4">
      <div className="flex gap-2 items-center max-w-3xl overflow-x-auto pb-1 px-2">
        {palette.colors.map((color, index) => (
          <button
            key={index}
            className={`w-8 h-8 rounded-md transition-transform ${
              playerState?.selectedColorIndex === index
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
