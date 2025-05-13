import { World } from "@/module_bindings";
import { formatDistanceToNow } from "date-fns";

interface WorldCardProps {
  world: World;
  onClick: (worldId: string) => void;
}

export default function WorldCard({ world, onClick }: WorldCardProps) {
  const lastVisitedRelative = formatDistanceToNow(world.lastVisited.toDate(), {
    addSuffix: true,
  });

  return (
    <div
      className="border rounded p-4 cursor-pointer hover:bg-secondary/10 transition-colors"
      onClick={() => onClick(world.id)}
    >
      <h2 className="text-xl font-semibold">{world.name}</h2>
      <div className="mt-2 space-y-1">
        <p className="text-sm">
          <span className="text-muted-foreground">Size:</span> {world.xWidth}x
          {world.yWidth}x{world.height}
        </p>
        <p className="text-sm text-muted-foreground">
          Last visited: {lastVisitedRelative}
        </p>
      </div>
    </div>
  );
}
