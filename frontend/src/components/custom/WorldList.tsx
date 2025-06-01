import { useState } from "react";
import { World } from "@/module_bindings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Timestamp } from "@clockworklabs/spacetimedb-sdk";
import React from "react";
import { FolderOpen, X } from "lucide-react";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useNavigate, useParams } from "react-router-dom";
import { createWorld } from "@/lib/createWorld";
import { Modal } from "../ui/modal";

interface WorldListProps {
  isOpen: boolean;
  onClose: () => void;
  worlds: World[];
  onWorldClick: (worldId: string) => void;
}

const getGroupLabel = (lastVisitedTimestamp: Timestamp): string => {
  const lastVisitedDate = lastVisitedTimestamp.toDate();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (lastVisitedDate >= todayStart) return "Today";

  const oneWeekAgoStart = new Date(todayStart);
  oneWeekAgoStart.setDate(todayStart.getDate() - 7);
  if (lastVisitedDate >= oneWeekAgoStart) return "Last week";

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (lastVisitedDate >= startOfMonth) return "Earlier this month";

  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(startOfMonth);
  endOfLastMonth.setDate(startOfMonth.getDate() - 1);
  if (lastVisitedDate >= startOfLastMonth && lastVisitedDate <= endOfLastMonth)
    return "Last month";

  return "Older";
};

const groupOrder = [
  "Today",
  "Last week",
  "Earlier this month",
  "Last month",
  "Older",
];

const WorldList: React.FC<WorldListProps> = ({
  isOpen,
  onClose,
  worlds,
  onWorldClick,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { connection } = useDatabase();
  const navigate = useNavigate();
  const { worldId } = useParams();

  const processedWorlds = React.useMemo(() => {
    if (worlds.length === 0) return {};
    const filtered = worlds.filter((world) =>
      world.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groups: Record<string, World[]> = Object.fromEntries(
      groupOrder.map((group) => [group, []])
    );

    filtered.forEach((world) => {
      const groupName = getGroupLabel(world.lastVisited as Timestamp);
      if (groups[groupName]) {
        groups[groupName].push(world);
      } else {
        groups["Older"].push(world);
      }
    });

    for (const groupName in groups) {
      groups[groupName].sort(
        (a, b) =>
          (b.lastVisited as Timestamp).toDate().getTime() -
          (a.lastVisited as Timestamp).toDate().getTime()
      );
    }
    return groups;
  }, [worlds, searchTerm]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="sm:max-w-[1200px] max-h-[80vh] flex flex-col p-0">
        <div className="px-6 pt-4">
          <div className="flex flex-row justify-between">
            <h2 className="text-xl font-semibold mb-6">Open a world</h2>
            <Button onClick={onClose} variant="ghost">
              <X />
            </Button>
          </div>

          <div className="flex justify-between items-center mb-4 border-b border-border">
            <div className="flex items-center space-x-4">
              <button className="text-primary font-semibold pb-2 border-b-2 border-primary">
                Recent
              </button>
            </div>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto pb-6 h-screen">
          <Input
            type="text"
            placeholder="Search worlds..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs h-8 my-1 ml-6"
          />

          {worlds.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 border border-dashed border-border px-6">
              <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="mb-2 text-lg font-medium text-foreground">
                No Worlds Found
              </p>
              <p className="mb-4 text-sm text-muted-foreground">
                You don't have any worlds yet. Create one to get started!
              </p>
              <Button
                variant="default"
                onClick={() => {
                  if (!connection?.isActive) return;
                  createWorld(connection, navigate);
                }}
              >
                Create New World
              </Button>
            </div>
          ) : (
            groupOrder.map((groupName) => {
              const worldsInGroup = processedWorlds[groupName];
              if (worldsInGroup && worldsInGroup.length > 0) {
                return (
                  <div key={groupName}>
                    <h2 className="text-sm px-6 font-semibold text-muted-foreground mb-2 mt-4">
                      {groupName}
                    </h2>
                    <div className="border-t border-border">
                      {worldsInGroup.map((world) => (
                        <div
                          key={world.id}
                          className="p-3 px-6 hover:bg-black/20 hover:text-accent-foreground cursor-pointer border-b border-border flex justify-between items-center"
                          onClick={() => {
                            onWorldClick(world.id);
                            onClose();
                          }}
                        >
                          <p className="font-medium text-foreground">
                            {world.name}{" "}
                            {world.id === worldId ? "(Current)" : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {world.xWidth}x{world.yWidth}x{world.height}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })
          )}
          {worlds.length > 0 &&
            Object.values(processedWorlds).every(
              (group) => group.length === 0
            ) &&
            searchTerm && (
              <p className="text-center text-muted-foreground mt-4">
                No worlds found matching your search.
              </p>
            )}
        </div>
      </div>
    </Modal>
  );
};

export default WorldList;
