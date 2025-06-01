import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CreateWorldButton from "@/components/custom/CreateWorldButton";
import CreateWorldDialog from "@/components/custom/CreateWorldDialog";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useWorlds } from "@/contexts/WorldContext";
import { Button } from "@/components/ui/button";
import { Moon, Earth } from "lucide-react";
import { FloatingVoxelsBackground } from "@/components/custom/FloatingVoxelsBackground";
import WorldList from "@/components/custom/WorldList";

export default function WorldListPage() {
  const navigate = useNavigate();
  const { connection } = useDatabase();
  const { userWorlds } = useWorlds();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isWorldListDialogOpen, setIsWorldListDialogOpen] = useState(false);

  const visitWorld = (worldId: string) => {
    if (!connection?.isActive) return;

    try {
      navigate(`/worlds/${worldId}`);
    } catch (err) {
      console.error("Error selecting world:", err);
    }
  };

  const handleOpenCreateNewDialogFromList = () => {
    setIsCreateDialogOpen(true);
  };

  return (
    <>
      <FloatingVoxelsBackground />
      <div className="relative z-0 h-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto">
        <div className="w-full max-w-2xl flex flex-col items-center bg-background/80 backdrop-blur-md backdrop-brightness-75 rounded-xl p-6 sm:p-8 border border-border">
          <CreateWorldDialog
            isOpen={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          />

          <div className="flex flex-col items-center justify-center text-center w-full">
            <div className="p-1 mb-4">
              <Moon className="h-16 w-16 md:h-24 md:w-24 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
              LunaVoxel
            </h1>
            <p className="text-base md:text-lg text-foreground/80 mb-6 max-w-xl">
              Build, explore, and share your voxel creations. Get started by
              opening an existing world or creating a new one.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                variant="outline"
                onClick={() => setIsWorldListDialogOpen(true)}
                className="w-full sm:w-auto"
              >
                <Earth className="h-5 w-5" />
                Open World
              </Button>
              <CreateWorldButton
                onClick={() => setIsCreateDialogOpen(true)}
                className="w-full sm:w-auto"
              >
                Create New
              </CreateWorldButton>
            </div>
          </div>

          <WorldList
            isOpen={isWorldListDialogOpen}
            onOpenChange={setIsWorldListDialogOpen}
            worlds={userWorlds}
            onWorldClick={visitWorld}
            onCreateNew={handleOpenCreateNewDialogFromList}
          />
        </div>
      </div>
    </>
  );
}
