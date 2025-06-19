import { ColorPalette, EventContext, Project } from "@/module_bindings";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useDatabase } from "./DatabaseContext";
import { useParams } from "react-router-dom";

interface CurrentProjectContextType {
  project: Project;
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
    throw new Error(
      "useCurrentProject must be used within a CurrentProjectProvider"
    );
  }
  return context;
}

export function CurrentProjectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [palette, setPalette] = useState<ColorPalette | null>(null);
  const { connection } = useDatabase();
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedColor, setSelectedColor] = React.useState<number>(0);

  useEffect(() => {
    if (!connection?.identity || !projectId) return;

    const projectSub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        console.log("subscribed to project for ", projectId);
        const newProject = (
          connection.db.projects.tableCache.iter() as Project[]
        ).find((p) => p.id === projectId);
        if (!newProject) {
          console.error("CurrentProjectContext: Missing project");
          return;
        }
        setProject(newProject);
      })
      .onError((error) => {
        console.error("Project subscription error:", error);
      })
      .subscribe([`SELECT * FROM projects WHERE Id='${projectId}'`]);

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

    const onProjectInsert = (ctx: EventContext, row: Project) => {
      if (row.id === projectId) {
        setProject(row);
      }
    };

    const onProjectUpdate = (
      ctx: EventContext,
      oldProject: Project,
      newProject: Project
    ) => {
      if (newProject.id === projectId) {
        setProject(newProject);
      }
    };

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

    connection.db.projects.onInsert(onProjectInsert);
    connection.db.projects.onUpdate(onProjectUpdate);
    connection.db.colorPalette.onInsert(onPaletteInsert);
    connection.db.colorPalette.onUpdate(onPaletteUpdate);

    return () => {
      projectSub.unsubscribe();
      colorPaletteSub.unsubscribe();
      connection.db.projects.removeOnInsert(onProjectInsert);
      connection.db.projects.removeOnUpdate(onProjectUpdate);
      connection.db.colorPalette.removeOnInsert(onPaletteInsert);
      connection.db.colorPalette.removeOnUpdate(onPaletteUpdate);
    };
  }, [connection, projectId]);

  if (!project || !palette) {
    console.log("missing project or palette", { project, palette });
    return null;
  }

  return (
    <ProjectContext.Provider
      value={{ project, palette, selectedColor, setSelectedColor }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
