import { useState } from "react";
import { World } from "@/module_bindings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Timestamp } from "@clockworklabs/spacetimedb-sdk";
import React from "react";
import { FileWarning, FolderOpen, PlusCircle, Search, X } from "lucide-react";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useNavigate, useParams } from "react-router-dom";
import { createWorld } from "@/lib/createWorld";
import { Modal } from "../ui/modal";
import { useAuth } from "@/firebase/AuthContext";

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

const SignInPrompt: React.FC = () => {
  const { signInWithGoogle } = useAuth();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-8">
      <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-3 text-foreground">
        Sign in to view your worlds
      </h2>
      <p className="mb-6 text-sm text-muted-foreground max-w-md">
        Sign in with Google to access your saved worlds and create new ones.
      </p>
      <Button onClick={handleSignIn} className="flex items-center gap-2">
        <svg
          className="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
        >
          <path
            fill="#FFC107"
            d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
          />
          <path
            fill="#FF3D00"
            d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
          />
          <path
            fill="#4CAF50"
            d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
          />
          <path
            fill="#1976D2"
            d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
          />
        </svg>
        Sign In with Google
      </Button>
    </div>
  );
};

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
  const { currentUser } = useAuth();

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

  if (currentUser?.isAnonymous) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <div className="sm:max-w-[600px] min-h-[400px] w-[70vw] flex flex-col p-0">
          <div className="px-6 pt-4 flex-shrink-0">
            <div className="flex flex-row justify-between">
              <h2 className="text-xl font-semibold mb-6">Open a world</h2>
              <Button onClick={onClose} variant="ghost">
                <X />
              </Button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <SignInPrompt />
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="sm:max-w-[1200px] min-h-[80vh] max-h-[90vh] w-[70vw] flex flex-col p-0">
        <div className="px-6 pt-4 flex-shrink-0">
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

        <div className="flex flex-col flex-grow overflow-y-auto">
          <div className="flex flex-row items-center justify-between px-6 py-4">
            <Input
              type="text"
              placeholder="Search worlds..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs h-8 my-1"
            />

            <Button
              onClick={() => {
                if (!connection?.isActive) return;
                createWorld(connection, navigate);
                onClose();
              }}
              className="h-8"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create new</span>
            </Button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            {worlds.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 px-6">
                <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="mb-2 text-lg font-medium text-foreground">
                  No Worlds Found
                </p>
                <p className="mb-4 text-sm text-muted-foreground">
                  You don't have any worlds yet. Create one to get started!
                </p>
                <Button
                  onClick={() => {
                    if (!connection?.isActive) return;
                    createWorld(connection, navigate);
                    onClose();
                  }}
                  className="w-full sm:w-auto"
                >
                  Create New World
                </Button>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
                {Object.entries(processedWorlds).map(
                  ([groupName, groupWorlds]) =>
                    groupWorlds.length > 0 && (
                      <div key={groupName} className="mb-6">
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                          {groupName}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {groupWorlds.map((world) => (
                            <div
                              key={world.id}
                              onClick={() => {
                                onWorldClick(world.id);
                                onClose();
                              }}
                              className={`cursor-pointer group relative bg-card hover:bg-accent border border-border rounded-lg p-3 transition-all duration-200 hover:shadow-md ${
                                worldId === world.id
                                  ? "ring-2 ring-primary bg-accent"
                                  : ""
                              }`}
                            >
                              <div className="aspect-video bg-muted rounded-md mb-3 flex items-center justify-center">
                                <Search className="w-8 h-8 text-muted-foreground" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="font-medium text-sm truncate">
                                  {world.name}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  {(world.lastVisited as Timestamp)
                                    .toDate()
                                    .toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default WorldList;
