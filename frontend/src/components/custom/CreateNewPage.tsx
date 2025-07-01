import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject } from "@/lib/createProject";

export function CreateNewPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createAndRedirect = async () => {
      try {
        const result = await createProject(navigate);
        if (!result.success) {
          setError(
            result.error || "Failed to create project. Please try again."
          );
        }
      } catch (err) {
        console.error("Error creating project:", err);
        setError("Failed to create project. Please try again.");
      }
    };

    createAndRedirect();
  }, [navigate]);

  if (error) {
    return (
      <>
        <div className="relative z-0 h-full flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md flex flex-col items-center backdrop-blur-lg backdrop-brightness-70 rounded-xl p-8 border border-border text-center">
            <div className="p-1 mb-4 text-4xl animate-pulse">🌙</div>
            <h1 className="text-2xl font-bold mb-4 text-foreground">
              Creation Failed
            </h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button
              onClick={() => navigate("/", { replace: true })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="relative z-0 h-full flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md flex flex-col items-center backdrop-blur-lg backdrop-brightness-70 rounded-xl p-8 border border-border text-center">
          <div className="p-1 mb-4 text-4xl animate-pulse">🌙</div>
          <h1 className="text-2xl font-bold mb-4 text-foreground">
            Creating Project
          </h1>
          <p className="text-muted-foreground mb-6">
            Generating your new voxel project...
          </p>
          <div className="w-8 h-8 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    </>
  );
}
