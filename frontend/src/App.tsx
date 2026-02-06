import { useEffect, useState } from "react";
import { EditorPage } from "./pages/EditorPage";
import { Toaster } from "sonner";
import { globalStore, reducers } from "./state";

const EDITOR_ID = "editor";

function AppContent() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    globalStore.setCurrentUserId("local-user");
    reducers.initializeEditor(EDITOR_ID, 64, 64, 64);
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return <EditorPage />;
}

export default function App() {
  return (
    <>
      <AppContent />
      <Toaster />
    </>
  );
}
