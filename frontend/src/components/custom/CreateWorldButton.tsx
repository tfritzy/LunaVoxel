import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useDatabase } from "@/contexts/DatabaseContext";

export default function CreateWorldButton() {
  const { connection } = useDatabase();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const createNewWorld = async () => {
    if (!connection.isActive || isCreating) return;

    try {
      setIsCreating(true);
      const defaultName = `World ${Date.now().toString().slice(-6)}`;

      const onCreateWorldHandler = (ctx, name, xDim, yDim, zDim) => {
        if (
          name === defaultName &&
          ctx.event.callerIdentity.isEqual(connection.identity)
        ) {
          const newWorlds = Array.from(connection.db.world.iter()).filter(
            (w) =>
              w.name === defaultName && w.owner.isEqual(connection.identity!)
          );

          if (newWorlds.length > 0) {
            navigate(`/worlds/${newWorlds[0].id}`);
          }

          connection.reducers.removeOnCreateWorld(onCreateWorldHandler);
        }
      };

      connection.reducers.onCreateWorld(onCreateWorldHandler);

      connection.reducers.createWorld(defaultName, 16, 16, 16);
    } catch (err) {
      console.error("Error creating new world:", err);
      setIsCreating(false);
    }
  };

  return (
    <Button variant="outline" onClick={createNewWorld} disabled={isCreating}>
      <Plus className="h-4 w-4 mr-2" />
      {isCreating ? "Creating..." : "Create New World"}
    </Button>
  );
}
