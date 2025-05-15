import { useNavigate } from "react-router-dom";
import CreateWorldButton from "@/components/custom/CreateWorldButton";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useWorldManagement } from "@/hooks/useWorldManagement";

export default function WorldListPage() {
  const navigate = useNavigate();
  const { connection } = useDatabase();
  const { myWorlds } = useWorldManagement();

  const visitWorld = (worldId: string) => {
    if (!connection?.isActive) return;

    console.log("visiting ", worldId);

    try {
      connection.reducers.visitWorld(worldId);
      navigate(`/worlds/${worldId}`);
    } catch (err) {
      console.error("Error selecting world:", err);
    }
  };

  return (
    <div className="pt-16 mx-auto p-4">
      <div className="flex flex-row justify-between mb-4">
        <h1 className="text-2xl font-bold mb-4">Your Worlds</h1>

        <div className="mb-4">
          <CreateWorldButton />
        </div>
      </div>

      {myWorlds.length === 0 ? (
        <div className="text-center p-8 border border-border rounded">
          <p className="mb-4">You don't have any worlds yet.</p>
          <CreateWorldButton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myWorlds.map((world) => (
            <div
              key={world.id}
              className="bg-card border border-border rounded p-4 cursor-pointer hover:bg-secondary/10"
              onClick={() => visitWorld(world.id)}
            >
              <h2 className="text-xl text-foreground font-semibold">
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
