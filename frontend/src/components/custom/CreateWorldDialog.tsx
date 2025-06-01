import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useNavigate } from "react-router-dom";

const MAX_DIMENSION = 512;

export default function CreateWorldDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { connection } = useDatabase();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState(`World ${Date.now().toString().slice(-6)}`);
  const [xDim, setXDim] = useState(16);
  const [yDim, setYDim] = useState(16);
  const [zDim, setZDim] = useState(16);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const validateInput = () => {
    if (!name.trim()) {
      setError("World name is required");
      return false;
    }

    if (xDim < 1 || xDim > MAX_DIMENSION) {
      setError(`Width must be between 1 and ${MAX_DIMENSION}`);
      return false;
    }

    if (yDim < 1 || yDim > MAX_DIMENSION) {
      setError(`Depth must be between 1 and ${MAX_DIMENSION}`);
      return false;
    }

    if (zDim < 1 || zDim > MAX_DIMENSION) {
      setError(`Height must be between 1 and ${MAX_DIMENSION}`);
      return false;
    }

    setError(null);
    return true;
  };

  const handleNumberInput = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    value: string
  ) => {
    if (value === "") {
      setter(0);
      return;
    }

    if (!/^\d*$/.test(value)) {
      return;
    }

    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      setter(Math.min(Math.max(parsed, 1), MAX_DIMENSION));
    }
  };

  const handleCreateWorld = async () => {
    if (!connection?.isActive || isCreating || !validateInput()) return;

    try {
      setIsCreating(true);

      connection.reducers.createWorld(name, xDim, yDim, zDim);

      const worldId = `wrld_${name}`;
      navigate(`/worlds/${worldId}`);

      onOpenChange(false);
      setIsCreating(false);

      setName(`World ${Date.now().toString().slice(-6)}`);
      setXDim(16);
      setYDim(16);
      setZDim(16);
    } catch (err) {
      console.error("Error creating new world:", err);
      setError("Failed to create world. Please try again.");
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New World</DialogTitle>
          <DialogDescription>
            Enter details for your new voxel world. Once created, it will appear
            in your world list.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              World Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My World"
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="xDim" className="text-sm font-medium">
                Width (X)
              </label>
              <Input
                id="xDim"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={xDim === 0 ? "" : xDim.toString()}
                onChange={(e) => handleNumberInput(setXDim, e.target.value)}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="yDim" className="text-sm font-medium">
                Depth (Y)
              </label>
              <Input
                id="yDim"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={yDim === 0 ? "" : yDim.toString()}
                onChange={(e) => handleNumberInput(setYDim, e.target.value)}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="zDim" className="text-sm font-medium">
                Height (Z)
              </label>
              <Input
                id="zDim"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={zDim === 0 ? "" : zDim.toString()}
                onChange={(e) => handleNumberInput(setZDim, e.target.value)}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateWorld} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create World"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
