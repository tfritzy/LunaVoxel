import { useRef, useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/firebase/AuthContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { createProject } from "@/lib/createProject";
import { ProjectLayout } from "@/components/custom/ProjectLayout";
import { BlockModificationMode, Project } from "@/module_bindings";
import { VoxelEngine } from "@/modeling/voxel-engine";
import { Button } from "@/components/ui/button";
import { ExportType } from "@/modeling/export/model-exporter";
import { useAtlas } from "@/lib/useAtlas";
import { Mail, X } from "lucide-react";
import { Timestamp } from "@clockworklabs/spacetimedb-sdk";
import { SignInModal } from "@/components/custom/SignInModal";

export const SignInPage = () => {
  const {
    signInWithGoogle,
    signInWithGithub,
    signInWithMicrosoft,
    signInWithApple,
    error,
    clearError,
  } = useAuth();
  const { connection } = useDatabase();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<number>(1);
  const [currentTool, setCurrentTool] = useState<BlockModificationMode>({
    tag: "Build",
  });
  const atlasData = useAtlas();
  const isInitializedRef = useRef<boolean>(false);

  const handleProviderSignIn = useCallback(
    async (provider: "google" | "github" | "microsoft" | "apple") => {
      try {
        let user;
        switch (provider) {
          case "google":
            user = await signInWithGoogle();
            break;
          case "github":
            user = await signInWithGithub();
            break;
          case "microsoft":
            user = await signInWithMicrosoft();
            break;
          case "apple":
            user = await signInWithApple();
            break;
        }

        if (user && connection) {
          await createProject(connection, navigate);
        }
      } catch (error) {
        console.error(`Error signing in with ${provider}:`, error);
      }
    },
    [
      signInWithGoogle,
      signInWithGithub,
      signInWithMicrosoft,
      signInWithApple,
      connection,
      navigate,
    ]
  );

  const demoProject: Project = {
    id: "demo",
    name: "Demo Project",
    dimensions: { x: 32, y: 32, z: 32 },
    created: Timestamp.fromDate(new Date()),
    updated: Timestamp.fromDate(new Date()),
    owner: connection?.identity || ({} as any),
    publicAccess: { tag: "None" } as any,
  };

  const containerCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;

      if (!node || !connection || !atlasData || isInitializedRef.current)
        return;

      isInitializedRef.current = true;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!node.isConnected || engineRef.current) return;

          engineRef.current = new VoxelEngine({
            container: node,
            connection,
            project: demoProject,
          });

          engineRef.current.projectManager?.setSelectedBlock(selectedBlock);
          engineRef.current.projectManager?.setTool(currentTool);
          engineRef.current.projectManager?.setAtlasData(atlasData);
        });
      });
    },
    [connection, atlasData, selectedBlock, currentTool, demoProject]
  );

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!engineRef.current || !containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (engineRef.current) {
        engineRef.current.handleContainerResize();
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    engineRef.current?.projectManager?.setSelectedBlock(selectedBlock);
  }, [selectedBlock]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.projectManager?.setTool(currentTool);
    }
  }, [currentTool]);

  useEffect(() => {
    if (engineRef.current?.projectManager && atlasData) {
      engineRef.current.projectManager.setAtlasData(atlasData);
    }
  }, [atlasData]);

  const handleExport = useCallback((type: ExportType) => {
    // No-op for sign-in page
  }, []);

  const handleUndo = useCallback(() => {
    // No-op for sign-in page
  }, []);

  const handleRedo = useCallback(() => {
    // No-op for sign-in page
  }, []);

  const handleToolChange = useCallback((tool: BlockModificationMode) => {
    setCurrentTool(tool);
  }, []);

  const handleLayerSelect = useCallback((layerIndex: number) => {
    engineRef.current?.projectManager?.builder.setSelectedLayer(layerIndex);
  }, []);

  return (
    <ProjectLayout
      projectId="demo"
      selectedBlock={selectedBlock}
      setSelectedBlock={setSelectedBlock}
      currentTool={currentTool}
      onToolChange={handleToolChange}
      onExport={handleExport}
      onSelectLayer={handleLayerSelect}
      onUndo={handleUndo}
      onRedo={handleRedo}
      atlasData={atlasData}
    >
      <div className="w-full h-full bg-background relative">
        <div ref={containerCallbackRef} className="w-full h-full" />

        <SignInModal
          title="Welcome to LunaVoxel"
          subheader="You must be signed in to create or edit projects"
          onSignIn={() => createProject(connection, navigate)}
        />
      </div>
    </ProjectLayout>
  );
};
