import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { LayerRow } from "./LayerRow";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useDatabase } from "@/contexts/DatabaseContext";
import React from "react";
import { Layer } from "@/module_bindings";

export function LayersSection() {
  const { connection } = useDatabase();
  const { layers, project, selectedLayer, setSelectedLayer } =
    useCurrentProject();

  const addLayer = React.useCallback(() => {
    connection?.reducers.addLayer(project.id);
  }, [connection?.reducers, project.id]);

  const onDelete = React.useCallback(
    (layer: Layer) => {
      connection?.reducers.deleteLayer(layer.id);

      if (selectedLayer === layer.index) {
        const nextFirst = layers.find((l) => l.index !== layer.index);
        if (nextFirst) {
          setSelectedLayer(nextFirst.index);
        }
      }
    },
    [connection?.reducers, layers, selectedLayer, setSelectedLayer]
  );

  const toggleVisibility = React.useCallback(
    (layer: Layer) => {
      connection?.reducers.toggleLayerVisibility(layer.id);
    },
    [connection?.reducers]
  );

  const toggleLocked = React.useCallback(
    (layer: Layer) => {
      connection?.reducers.toggleLayerLock(layer.id);
    },
    [connection?.reducers]
  );

  return (
    <div className="">
      <div className="w-full flex flex-row justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Layers</h2>
        <Button variant="ghost" onClick={addLayer}>
          <Plus />
        </Button>
      </div>

      <div className="flex flex-col space-y-1">
        {layers.map((l) => (
          <LayerRow
            layer={l}
            key={l.index}
            isSelected={selectedLayer === l.index}
            onSelect={() => setSelectedLayer(l.index)}
            onDelete={onDelete}
            onToggleVisibility={toggleVisibility}
            onToggleLocked={toggleLocked}
          />
        ))}
      </div>
    </div>
  );
}
