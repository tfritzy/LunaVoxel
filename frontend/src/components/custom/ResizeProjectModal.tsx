import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Vector3 } from "@/state/types";

interface ResizeProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDimensions: Vector3;
  onResize: (newDimensions: Vector3, anchor: Vector3) => void;
}

type AnchorValue = 0 | 0.5 | 1;

const ANCHOR_LABELS: Record<number, string> = {
  0: "−",
  0.5: "●",
  1: "+",
};

const AnchorSlice = ({
  layer,
  anchor,
  onAnchorChange,
  axisLabels,
}: {
  layer: AnchorValue;
  anchor: Vector3;
  onAnchorChange: (anchor: Vector3) => void;
  axisLabels: { row: string; col: string; layer: string };
}) => {
  const values: AnchorValue[] = [0, 0.5, 1];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-xs text-muted-foreground">
        Y = {ANCHOR_LABELS[layer]}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {values.map((row) => {
          const rowVal = (1 - row) as AnchorValue;
          return values.map((col) => {
            const isSelected =
              anchor.x === col && anchor.y === layer && anchor.z === rowVal;
            return (
              <button
                key={`${layer}-${row}-${col}`}
                onClick={() =>
                  onAnchorChange({ x: col, y: layer, z: rowVal })
                }
                className={`w-7 h-7 rounded border-2 transition-colors ${
                  isSelected
                    ? "bg-primary border-primary"
                    : "bg-muted border-border hover:border-muted-foreground"
                }`}
              />
            );
          });
        })}
      </div>
      <div className="flex justify-between w-full text-[10px] text-muted-foreground px-1">
        <span>−{axisLabels.col}</span>
        <span>+{axisLabels.col}</span>
      </div>
    </div>
  );
};

export const ResizeProjectModal = ({
  isOpen,
  onClose,
  currentDimensions,
  onResize,
}: ResizeProjectModalProps) => {
  const [dimensions, setDimensions] = useState<Vector3>({
    ...currentDimensions,
  });
  const [anchor, setAnchor] = useState<Vector3>({ x: 0, y: 0, z: 0 });

  const handleDimensionChange = (axis: keyof Vector3, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      setDimensions((prev) => ({ ...prev, [axis]: num }));
    }
  };

  const handleSubmit = () => {
    onResize(dimensions, anchor);
    onClose();
  };

  const unchanged =
    dimensions.x === currentDimensions.x &&
    dimensions.y === currentDimensions.y &&
    dimensions.z === currentDimensions.z;

  const layers: AnchorValue[] = [1, 0.5, 0];
  const axisLabels = { row: "Z", col: "X", layer: "Y" };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Resize Project"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={unchanged}>
            Resize
          </Button>
        </>
      }
    >
      <div className="px-6 pb-4 space-y-6">
        <div>
          <div className="text-sm font-medium text-foreground mb-3">
            New Dimensions
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["x", "y", "z"] as const).map((axis) => (
              <div key={axis}>
                <label className="text-xs text-muted-foreground uppercase mb-1 block">
                  {axis}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={512}
                  value={dimensions[axis]}
                  onChange={(e) => handleDimensionChange(axis, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-foreground mb-3">
            Anchor Point
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            Select where existing content stays anchored during resize.
          </div>
          <div className="flex gap-4 justify-center items-end">
            {layers.map((layer) => (
              <AnchorSlice
                key={layer}
                layer={layer}
                anchor={anchor}
                onAnchorChange={setAnchor}
                axisLabels={axisLabels}
              />
            ))}
          </div>
          <div className="flex justify-center mt-2">
            <div className="text-[10px] text-muted-foreground">
              −Z ↑ / +Z ↓
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
