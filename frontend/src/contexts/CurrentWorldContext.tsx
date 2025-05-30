import { ColorPalette, EventContext, PlayerInWorld } from "@/module_bindings";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useDatabase } from "./DatabaseContext";
import { useParams } from "react-router-dom";

interface CurrentWorldContextType {
  palette: ColorPalette;
  player: PlayerInWorld;
}

const WorldsContext = createContext<CurrentWorldContextType | undefined>(
  undefined
);

export function useCurrentWorld() {
  const context = useContext(WorldsContext);
  if (context === undefined) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
}

export function CurrentWorldProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [palette, setPalette] = useState<ColorPalette | null>(null);
  const [player, setPlayer] = useState<PlayerInWorld | null>(null);
  const { connection } = useDatabase();
  const { worldId } = useParams<{ worldId: string }>();

  useEffect(() => {
    if (!connection?.identity || !worldId) return;

    const colorPaletteSub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        const newPalette = connection.db.colorPalette.tableCache
          .iter()
          .find((p) => p.world === worldId);
        setPalette(newPalette);

        if (!newPalette) {
          console.log(
            "CurrentWorldContext: Missing palette, calling visitWorld reducer"
          );
          connection.reducers.visitWorld(worldId);
        }
      })
      .onError((error) => {
        console.error("Color palette subscription error:", error);
      })
      .subscribe([`SELECT * FROM ColorPalette WHERE World='${worldId}'`]);

    const playerSub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        const newPlayer = connection.db.playerInWorld.tableCache
          .iter()
          .find((p) => p.world === worldId);
        setPlayer(newPlayer);

        if (!newPlayer) {
          console.log(
            "CurrentWorldContext: Missing player, calling visitWorld reducer"
          );
          connection.reducers.visitWorld(worldId);
        }
      })
      .onError((error) => {
        console.error("Player subscription error:", error);
      })
      .subscribe([
        `SELECT * FROM PlayerInWorld WHERE Player='${connection.identity.toHexString()}' AND World='${worldId}'`,
      ]);

    const onPaletteInsert = (ctx: EventContext, row: ColorPalette) => {
      if (row.world === worldId) {
        setPalette(row);
      }
    };

    const onPaletteUpdate = (
      ctx: EventContext,
      oldPalette: ColorPalette,
      newPalette: ColorPalette
    ) => {
      if (newPalette.world === worldId) {
        setPalette(newPalette);
      }
    };

    const onPlayerInsert = (ctx: EventContext, row: PlayerInWorld) => {
      if (row.world === worldId) {
        setPlayer(row);
      }
    };

    const onPlayerUpdate = (
      ctx: EventContext,
      oldPlayer: PlayerInWorld,
      newPlayer: PlayerInWorld
    ) => {
      if (newPlayer.world === worldId) {
        setPlayer(newPlayer);
      }
    };

    connection.db.colorPalette.onInsert(onPaletteInsert);
    connection.db.colorPalette.onUpdate(onPaletteUpdate);
    connection.db.playerInWorld.onInsert(onPlayerInsert);
    connection.db.playerInWorld.onUpdate(onPlayerUpdate);

    return () => {
      colorPaletteSub.unsubscribe();
      playerSub.unsubscribe();
      connection.db.colorPalette.removeOnInsert(onPaletteInsert);
      connection.db.colorPalette.removeOnUpdate(onPaletteUpdate);
      connection.db.playerInWorld.removeOnInsert(onPlayerInsert);
      connection.db.playerInWorld.removeOnUpdate(onPlayerUpdate);
    };
  }, [connection, worldId]);

  if (!palette || !player) {
    console.log("missing player or missing palette", palette, player);
    return null;
  }

  return (
    <WorldsContext.Provider value={{ palette, player }}>
      {children}
    </WorldsContext.Provider>
  );
}
