import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Vector3 } from "@/state/types";
import { useGlobalState } from "@/state/store";
import { AnchorPreview3D } from "./AnchorPreview3D";

interface ResizeProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDimensions: Vector3;
  onResize: (newDimensions: Vector3, anchor: Vector3) => void;
}

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
  const colors = useGlobalState((state) => state.blocks.colors);

  const handleDimensionChange = (axis: keyof Vector3, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0 && num <= 512) {
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Resize Project"
      size="xl"
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
      <div className="px-6 pb-4 space-y-4">
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
          <div className="text-sm font-medium text-foreground mb-2">
            Anchor Point
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            Click a sphere to set the anchor. Drag to orbit. Scroll to zoom.
          </div>
          {isOpen && (
            <AnchorPreview3D
              currentDimensions={currentDimensions}
              newDimensions={dimensions}
              anchor={anchor}
              onAnchorChange={setAnchor}
              colors={colors}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};
