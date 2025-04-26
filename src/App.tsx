import { useRef, useEffect } from "react";
import "./App.css"; // Your styles
import { VoxelEngine } from "./modeling/voxel-engine";

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);

  useEffect(() => {
    // Only initialize if the container exists and engine hasn't been created yet
    if (containerRef.current && !engineRef.current) {
      engineRef.current = new VoxelEngine({
        container: containerRef.current,
      });
    }

    // Cleanup function to properly dispose of resources
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, []); // Empty dependency array means this runs once on mount

  return (
    <div className="app">
      <main className="app-content">
        <div
          ref={containerRef}
          className="voxel-container"
          style={{
            width: "100%",
            height: "100vh",
            position: "relative",
          }}
        />
      </main>
    </div>
  );
}

export default App;
