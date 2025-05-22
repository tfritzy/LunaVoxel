import {
  ColorPalette,
  EventContext,
  PlayerInWorld,
  World,
} from "@/module_bindings";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useDatabase } from "./DatabaseContext";
import { useParams } from "react-router-dom";

interface CurrentWorldContextType {
  // currentWorld: World;
  palette: ColorPalette;
  // player: PlayerInWorld;
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
  const { connection } = useDatabase();
  const { worldId } = useParams<{ worldId: string }>();

  useEffect(() => {
    if (!connection?.identity) throw "Connection has no identity";
    const colorPaletteSub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        console.log("color palette query applied", worldId);
        setPalette(
          connection.db.colorPalette.tableCache
            .iter()
            .find((p) => p.world === worldId)
        );
      })
      .onError((error) => {
        console.error("World subscription error:", error);
      })
      .subscribe([`SELECT * FROM ColorPalette WHERE World='${worldId}'`]);

    const onPaletteInsert = (ctx: EventContext, row: ColorPalette) => {
      console.log("on palette insert", row);
      if (row.world === worldId) {
        setPalette(row);
      }
    };

    const onPaletteUpdate = (
      ctx: EventContext,
      oldPalette: ColorPalette,
      newPalette: ColorPalette
    ) => {
      console.log("on palette update", newPalette);
      if (newPalette.world === worldId) {
        setPalette(newPalette);
      }
    };

    connection.db.colorPalette.onInsert(onPaletteInsert);
    connection.db.colorPalette.onUpdate(onPaletteUpdate);

    return () => {
      colorPaletteSub.unsubscribe();
    };
  }, [connection, worldId]);

  if (!palette) return null;

  return (
    <WorldsContext.Provider value={{ palette: palette! }}>
      {children}
    </WorldsContext.Provider>
  );
}
