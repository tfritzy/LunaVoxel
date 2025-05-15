import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useDatabase } from "@/contexts/DatabaseContext";

export default function CreateWorldButton() {
  const { connection } = useDatabase();
  const [isCreating, setIsCreating] = useState(false);

  const createNewWorld = async () => {
    if (!connection?.isActive || isCreating) return;

    try {
      setIsCreating(true);
      const defaultName = `World ${Date.now().toString().slice(-6)}`;
      connection.reducers.createWorld(defaultName, 16, 16, 16);
      setIsCreating(false);
    } catch (err) {
      console.error("Error creating new world:", err);
      setIsCreating(false);
    }
  };

  return (
    <Button onClick={createNewWorld} disabled={isCreating}>
      <Plus className="h-4 w-4" />
      {isCreating ? "Creating..." : "Create new"}
    </Button>
  );
}
