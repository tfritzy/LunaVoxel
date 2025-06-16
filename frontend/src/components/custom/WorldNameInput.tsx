import { useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { World, EventContext } from "@/module_bindings";
import { useDatabase } from "@/contexts/DatabaseContext";

export function WorldNameInput() {
  const { worldId } = useParams<{ worldId: string }>();
  const { connection } = useDatabase();
  const [localName, setLocalName] = useState("");
  const [world, setWorld] = useState<World | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!worldId || !connection) return;

    const subscription = connection
      .subscriptionBuilder()
      .onApplied(() => {
        const worldData = connection.db.world.id.find(worldId);
        if (worldData) {
          console.log("apply");
          setWorld(worldData);
          setLocalName(worldData.name || "");
        }
      })
      .onError((error) => {
        console.error("World subscription error:", error);
      })
      .subscribe([`SELECT * FROM World WHERE Id='${worldId}'`]);

    const onWorldUpdate = (
      ctx: EventContext,
      oldWorld: World,
      newWorld: World
    ) => {
      if (newWorld.id === worldId) {
        setWorld(newWorld);
        setLocalName(newWorld.name);
      }
    };

    connection.db.world.onUpdate(onWorldUpdate);

    return () => {
      connection.db.world.removeOnUpdate(onWorldUpdate);
      subscription.unsubscribe();
    };
  }, [worldId, connection]);

  useEffect(() => {
    if (!world || localName === world.name) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (localName.trim() && localName !== world.name) {
        connection?.reducers.updateWorldName(worldId!, localName.trim());
      }
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [localName, world, worldId, connection]);

  const handleFocus = () => {
    if (inputRef.current) {
      inputRef.current.select();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setLocalName(world?.name || "");
      inputRef.current?.blur();
    }
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setLocalName(e.target.value);
  };

  if (!world) {
    return <div />;
  }

  return (
    <input
      ref={inputRef}
      value={localName}
      onChange={handleValueChange}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className="bg-transparent border-none outline-none text-lg font-medium px-3 rounded focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all"
      placeholder="Untitled World"
    />
  );
}
