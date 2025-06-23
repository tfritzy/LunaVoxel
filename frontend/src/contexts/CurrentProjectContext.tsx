import {
  ColorPalette,
  EventContext,
  Project,
  PokeProject,
} from "@/module_bindings";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useDatabase } from "./DatabaseContext";
import { useParams } from "react-router-dom";

interface CurrentProjectContextType {
  project: Project | null;
  palette: ColorPalette | null;
  selectedColor: number;
  setSelectedColor: (color: number) => void;
  projectStatus: "loading" | "found" | "not-found" | "poke-attempted";
  retryProjectLoad: () => void;
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
  const [projectStatus, setProjectStatus] = useState<
    "loading" | "found" | "not-found" | "poke-attempted"
  >("loading");
  const [pokeAttempted, setPokeAttempted] = useState(false);

  const retryProjectLoad = () => {
    setProjectStatus("loading");
    setPokeAttempted(false);
    setProject(null);
    setPalette(null);
  };

  useEffect(() => {
    if (!connection?.identity || !projectId) return;

    setProjectStatus("loading");

    const projectSub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        console.log("subscribed to project for ", projectId);
        const newProject = (
          connection.db.projects.tableCache.iter() as Project[]
        ).find((p) => p.id === projectId);

        if (newProject) {
          setProject(newProject);
          setProjectStatus("found");
        } else if (!pokeAttempted) {
          setPokeAttempted(true);
          setProjectStatus("poke-attempted");
          console.log("Project not found, calling PokeProject for", projectId);

          connection.reducers.pokeProject(projectId);
        } else {
          setProjectStatus("not-found");
        }
      })
      .onError((error) => {
        console.error("Project subscription error:", error);
        setProjectStatus("not-found");
      })
      .subscribe([`SELECT * FROM projects WHERE Id='${projectId}'`]);

    const colorPaletteSub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        console.log("subscribed to palette for ", projectId);
        const newPalette = (
          connection.db.colorPalette.tableCache.iter() as ColorPalette[]
        ).find((p) => p.projectId === projectId);
        if (newPalette) {
          setPalette(newPalette);
        }
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
        setProjectStatus("found");
      }
    };

    const onProjectUpdate = (
      ctx: EventContext,
      oldProject: Project,
      newProject: Project
    ) => {
      if (newProject.id === projectId) {
        setProject(newProject);
        setProjectStatus("found");
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
  }, [connection, projectId, pokeAttempted]);

  if (!project || !palette) {
    if (projectStatus === "loading" || projectStatus === "poke-attempted") {
      return null;
    }

    if (projectStatus === "not-found") {
      return (
        <ProjectContext.Provider
          value={{
            project: null,
            palette: null,
            selectedColor,
            setSelectedColor,
            projectStatus,
            retryProjectLoad,
          }}
        >
          {children}
        </ProjectContext.Provider>
      );
    }

    return null;
  }

  return (
    <ProjectContext.Provider
      value={{
        project,
        palette,
        selectedColor,
        setSelectedColor,
        projectStatus,
        retryProjectLoad,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
