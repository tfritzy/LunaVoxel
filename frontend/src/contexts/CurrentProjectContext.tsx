import {
  Atlas,
  EventContext,
  Layer,
  Project,
  ProjectBlocks,
} from "@/module_bindings";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useDatabase } from "./DatabaseContext";
import { useParams } from "react-router-dom";
import { useAuth } from "@/firebase/AuthContext";
import { Button } from "@/components/ui/button";
import { AtlasSlot, useAtlas } from "@/lib/useAtlas";
import * as THREE from "three";
import { useBlocks } from "@/lib/useBlocks";
import { useLayers } from "@/lib/useLayers";

interface CurrentProjectContextType {
  project: Project;
  atlas: Atlas;
  atlasSlots: AtlasSlot[];
  textureAtlas: THREE.Texture | null;
  blocks: ProjectBlocks;
  layers: Layer[];
  selectedBlock: number;
  setSelectedBlock: (block: number) => void;
  selectedLayer: number;
  setSelectedLayer: (layer: number) => void;
  projectStatus: "loading" | "found" | "not-found" | "poke-attempted";
  retryProjectLoad: () => void;
}

const ProjectContext = createContext<CurrentProjectContextType | undefined>(
  undefined
);

export const useCurrentProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error(
      "useCurrentProject must be used within a CurrentProjectProvider"
    );
  }
  return context;
};

export const CurrentProjectProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const { connection } = useDatabase();
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedBlock, setSelectedBlock] = React.useState<number>(1);
  const [selectedLayer, setSelectedLayer] = React.useState<number>(0);
  const [projectStatus, setProjectStatus] = useState<
    "loading" | "found" | "not-found" | "poke-attempted"
  >("loading");
  const [pokeAttempted, setPokeAttempted] = useState(false);
  const { atlas, slots, texture } = useAtlas(projectId || "");
  const { blocks } = useBlocks(connection, projectId || "");
  const { layers } = useLayers(connection, projectId || "");

  const retryProjectLoad = () => {
    setProjectStatus("loading");
    setPokeAttempted(false);
    setProject(null);
  };

  useEffect(() => {
    if (!connection?.identity || !projectId) return;

    setProjectStatus("loading");

    const projectSub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        const newProject = (
          connection.db.projects.tableCache.iter() as Project[]
        ).find((p) => p.id === projectId);

        if (newProject) {
          setProject(newProject);
          setProjectStatus("found");
        } else if (!pokeAttempted) {
          setPokeAttempted(true);
          setProjectStatus("poke-attempted");

          connection.reducers.pokeProject(projectId);
        } else {
          console.warn("Project not found after poke attempt:", projectId);
          setProjectStatus("not-found");
        }
      })
      .onError((error) => {
        console.error("Project subscription error:", error);
        setProjectStatus("not-found");
      })
      .subscribe([`SELECT * FROM projects WHERE Id='${projectId}'`]);

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

    connection.db.projects.onInsert(onProjectInsert);
    connection.db.projects.onUpdate(onProjectUpdate);

    return () => {
      projectSub.unsubscribe();
      connection.db.projects.removeOnInsert(onProjectInsert);
      connection.db.projects.removeOnUpdate(onProjectUpdate);
    };
  }, [connection, projectId, pokeAttempted]);

  if (projectStatus === "loading" || projectStatus === "poke-attempted") {
    return <LoadingState status={projectStatus} />;
  }

  if (projectStatus === "not-found") {
    return <NotFoundState retryProjectLoad={retryProjectLoad} />;
  }

  if (!project || !atlas || !blocks) {
    return <LoadingState status="loading" />;
  }

  return (
    <ProjectContext.Provider
      value={{
        project,
        atlas,
        atlasSlots: slots,
        textureAtlas: texture,
        layers: layers,
        selectedBlock,
        setSelectedBlock,
        selectedLayer,
        setSelectedLayer,
        projectStatus,
        retryProjectLoad,
        blocks: blocks,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

const LoadingState = ({ status }: { status: "loading" | "poke-attempted" }) => (
  <div className="h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full animate-spin"></div>
      <p className="text-lg font-medium">
        {status === "poke-attempted"
          ? "Checking project access..."
          : "Loading project..."}
      </p>
    </div>
  </div>
);

const NotFoundState = ({
  retryProjectLoad,
}: {
  retryProjectLoad: () => void;
}) => {
  const { currentUser, signInWithGoogle } = useAuth();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      setTimeout(() => {
        retryProjectLoad();
      }, 1000);
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="bg-card p-8 rounded-lg shadow-lg max-w-md text-center border">
        <div className="w-16 h-16 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold mb-3">Project Not Found</h2>

        <p className="text-muted-foreground mb-6">
          This project either doesn't exist or you don't have access to it.
          {currentUser?.isAnonymous &&
            " You may need to sign in to view this project."}
        </p>

        <div className="space-y-3">
          {currentUser?.isAnonymous && (
            <Button onClick={handleSignIn} className="w-full">
              Sign In with Google
            </Button>
          )}
          <Button
            onClick={retryProjectLoad}
            variant="outline"
            className="w-full"
          >
            Try Again
          </Button>
          <p className="text-sm text-muted-foreground">
            Make sure you have access to this project or check that the link is
            correct
          </p>
        </div>
      </div>
    </div>
  );
};
