import { useRef, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { VoxelEngine } from "../modeling/voxel-engine";
import { useDatabase } from "@/contexts/DatabaseContext";
import { ColorPalette } from "@/components/custom/ColorPalette";
import { FloatingToolbar } from "@/components/custom/FloatingToolbar";
import { BlockModificationMode } from "@/module_bindings";
import { ProjectHeader } from "@/components/custom/ProjectHeader";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { useAuth } from "@/firebase/AuthContext";
import { Button } from "@/components/ui/button";

export const ProjectViewPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { connection } = useDatabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const [chunksLoading, setChunksLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<BlockModificationMode>({
    tag: "Build",
  });
  const { selectedColor, project, projectStatus, retryProjectLoad } =
    useCurrentProject();
  const { currentUser, signInWithGoogle } = useAuth();

  useEffect(() => {}, [selectedColor]);

  useEffect(() => {
    if (!projectId || !connection) return;

    setChunksLoading(true);

    const sub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        setChunksLoading(false);
      })
      .onError((err) => {
        console.error("Error subscribing to chunks:", err);
        setError(`Error loading chunks: ${err}`);
        setChunksLoading(false);
      })
      .subscribe([`SELECT * FROM chunk WHERE ProjectId='${projectId}'`]);

    return () => {
      sub.unsubscribe();
      setChunksLoading(true);

      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [projectId, connection]);

  useEffect(() => {
    if (chunksLoading || !connection || projectStatus !== "found") return;

    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }

    if (!project) {
      return;
    }

    engineRef.current = new VoxelEngine({
      container: containerRef.current!,
      connection,
      project,
    });

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [chunksLoading, connection, project, projectId, projectStatus]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.projectManager.setTool(currentTool);
    }
  }, [currentTool]);

  const handleToolChange = (tool: BlockModificationMode) => {
    setCurrentTool(tool);
  };

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

  const isProjectLoaded = projectStatus === "found" && project;

  return (
    <div>
      <ProjectHeader />
      <div className="h-full flex">
        {isProjectLoaded && !chunksLoading && !error && projectId && (
          <ColorPalette projectId={projectId} />
        )}

        <div className="flex-1 relative">
          <div
            ref={containerRef}
            className="voxel-container"
            style={{
              width: "100%",
              height: "100vh",
              position: "relative",
            }}
          />

          {isProjectLoaded && !chunksLoading && !error && (
            <FloatingToolbar
              currentTool={currentTool}
              onToolChange={handleToolChange}
            />
          )}

          {(chunksLoading ||
            projectStatus === "loading" ||
            projectStatus === "poke-attempted") && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full animate-spin"></div>
                <p className="text-lg font-medium">
                  {projectStatus === "poke-attempted"
                    ? "Checking project access..."
                    : "Loading project..."}
                </p>
              </div>
            </div>
          )}

          {projectStatus === "not-found" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm z-20">
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

                <h2 className="text-xl font-semibold mb-3">
                  Project Not Found
                </h2>

                <p className="text-muted-foreground mb-6">
                  This project either doesn't exist or you don't have access to
                  it.
                  {currentUser?.isAnonymous &&
                    " You may need to sign in to view this project."}
                </p>

                {currentUser?.isAnonymous && (
                  <div className="space-y-4">
                    <Button
                      onClick={handleSignIn}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <svg
                        className="h-4 w-4"
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
                      Sign In with Google
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Or check that the project link is correct
                    </p>
                  </div>
                )}

                {!currentUser?.isAnonymous && (
                  <div className="space-y-4">
                    <Button
                      onClick={retryProjectLoad}
                      variant="outline"
                      className="w-full"
                    >
                      Try Again
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Make sure you have access to this project or check that
                      the link is correct
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm z-20">
              <div className="bg-card p-6 rounded-lg shadow-lg max-w-md text-center">
                <p className="text-xl text-destructive font-medium mb-4">
                  {error}
                </p>
                <Button onClick={() => setError(null)} variant="outline">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
