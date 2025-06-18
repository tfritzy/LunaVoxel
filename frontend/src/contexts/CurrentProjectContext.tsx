import { ColorPalette, EventContext } from "@/module_bindings";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useDatabase } from "./DatabaseContext";
import { useParams } from "react-router-dom";

interface CurrentProjectContextType {
  palette: ColorPalette;
  selectedColor: number;
  setSelectedColor: (color: number) => void;
}

const ProjectContext = createContext<CurrentProjectContextType | undefined>(
  undefined
);

export function useCurrentProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
}

export function CurrentProjectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [palette, setPalette] = useState<ColorPalette | null>(null);
  const { connection } = useDatabase();
  const { projectId: projectId } = useParams<{ projectId: string }>();
  const [selectedColor, setSelectedColor] = React.useState<number>(0);

  useEffect(() => {
    if (!connection?.identity || !projectId) return;

    const colorPaletteSub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        console.log("subscribed to palette for ", projectId);
        const newPalette = (
          connection.db.colorPalette.tableCache.iter() as ColorPalette[]
        ).find((p) => p.projectId === projectId);

        if (!newPalette) {
          console.error("CurrentProjectContext: Missing palette");
          return;
        }

        setPalette(newPalette);
      })
      .onError((error) => {
        console.error("Color palette subscription error:", error);
      })
      .subscribe([
        `SELECT * FROM color_palette WHERE ProjectId='${projectId}'`,
      ]);

    const onPaletteInsert = (ctx: EventContext, row: ColorPalette) => {
      if (row.projectId === projectId) {
        setPalette(row);
      }
    };

    const onPaletteUpdate = (
      ctx: EventContext,
      oldPalette: ColorPalette,
      newPalette: ColorPalette
    ) => {
      if (newPalette.projectId === projectId) {
        setPalette(newPalette);
      }
    };

    connection.db.colorPalette.onInsert(onPaletteInsert);
    connection.db.colorPalette.onUpdate(onPaletteUpdate);

    return () => {
      colorPaletteSub.unsubscribe();
      connection.db.colorPalette.removeOnInsert(onPaletteInsert);
      connection.db.colorPalette.removeOnUpdate(onPaletteUpdate);
    };
  }, [connection, projectId]);

  if (!palette) {
    console.log("missing palette", palette);
    return null;
  }

  return (
    <ProjectContext.Provider
      value={{ palette, selectedColor, setSelectedColor }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
