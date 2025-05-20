import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CreateWorldButton from "@/components/custom/CreateWorldButton";
import CreateWorldDialog from "@/components/custom/CreateWorldDialog";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useWorldManagement } from "@/hooks/useWorldManagement";

export default function WorldListPage() {
  const navigate = useNavigate();
  const { connection } = useDatabase();
  const { myWorlds } = useWorldManagement();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const visitWorld = (worldId: string) => {
    if (!connection?.isActive) return;

    try {
      connection.reducers.visitWorld(worldId);
      navigate(`/worlds/${worldId}`);
    } catch (err) {
      console.error("Error selecting world:", err);
    }
  };

  return (
    <div className="pt-16 mx-auto p-4 max-w-7xl">
      <CreateWorldDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      <div className="flex flex-row justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Worlds</h1>
        <CreateWorldButton onClick={() => setIsCreateDialogOpen(true)} />
      </div>

      {myWorlds.length === 0 ? (
        <div className="text-center p-8 border border-border rounded-lg bg-card/50">
          <p className="mb-4 text-muted-foreground">
            You don't have any worlds yet.
          </p>
          <CreateWorldButton
            onClick={() => setIsCreateDialogOpen(true)}
            variant="secondary"
          >
            Create your first world
          </CreateWorldButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myWorlds
            .sort((w1, w2) => w1.name.localeCompare(w2.name))
            .map((world) => (
              <div
                key={world.id}
                className="bg-card border border-border rounded-lg p-6 cursor-pointer hover:bg-secondary/10 transition-colors shadow-sm"
                onClick={() => visitWorld(world.id)}
              >
                <h2 className="text-xl text-foreground font-semibold mb-2">
                  {world.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Last visited: {world.lastVisited.toDate().toLocaleString()}
                </p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
