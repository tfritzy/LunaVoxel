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

export const SignInPage = () => {
  const { signInWithGoogle } = useAuth();
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

  const handleSignIn = useCallback(async () => {
    try {
      const user = await signInWithGoogle();
      if (user && connection) {
        await createProject(connection, navigate);
      }
    } catch (error) {
      console.error("Error signing in:", error);
    }
  }, [signInWithGoogle, connection, navigate]);

  // Create a demo project object for the empty scene
  const demoProject: Project = {
    id: "demo",
    name: "Demo Project",
    dimensions: { x: 32, y: 32, z: 32 },
    created: { microseconds: BigInt(Date.now() * 1000) },
    updated: { microseconds: BigInt(Date.now() * 1000) },
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

  // Handlers for ProjectLayout
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

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-background/10 backdrop-blur-sm border border-border rounded-lg p-8 max-w-md w-full mx-4 pointer-events-auto shadow-2xl">
            <div className="text-center space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Welcome to LunaVoxel
                </h1>
                <p className="text-muted-foreground">
                  Authentication is required to create a project
                </p>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={handleSignIn}
                  size="lg"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-3"
                >
                  <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                  >
                    <path
                      fill="#FFC107"
                      d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
                    />
                  </svg>
                  Sign in with Google
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
};
