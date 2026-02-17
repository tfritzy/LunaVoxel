import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
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
  const [dimText, setDimText] = useState({
    x: String(currentDimensions.x),
    y: String(currentDimensions.y),
    z: String(currentDimensions.z),
  });
  const [anchor, setAnchor] = useState<Vector3>({ x: 0, y: 0, z: 0 });
  const colors = useGlobalState((state) => state.blocks.colors);

  const parseDim = (val: string) => {
    const n = parseInt(val, 10);
    return !isNaN(n) && n > 0 && n <= 512 ? n : null;
  };

  const dimensions: Vector3 = {
    x: parseDim(dimText.x) ?? currentDimensions.x,
    y: parseDim(dimText.y) ?? currentDimensions.y,
    z: parseDim(dimText.z) ?? currentDimensions.z,
  };

  const handleDimensionChange = (axis: keyof Vector3, value: string) => {
    if (value === "" || /^\d+$/.test(value)) {
      setDimText((prev) => ({ ...prev, [axis]: value }));
    }
  };

  const handleBlur = (axis: keyof Vector3) => {
    const parsed = parseDim(dimText[axis]);
    if (parsed === null) {
      setDimText((prev) => ({ ...prev, [axis]: String(currentDimensions[axis]) }));
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
      size="4xl"
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
        <div className="flex gap-4 items-end">
          {(["x", "y", "z"] as const).map((axis) => (
            <div key={axis} className="flex-1">
              <label className="text-xs text-muted-foreground uppercase mb-1 block">
                {axis}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={dimText[axis]}
                onChange={(e) => handleDimensionChange(axis, e.target.value)}
                onBlur={() => handleBlur(axis)}
                className="w-full h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground">
          Click a point to set anchor. Drag to orbit. Scroll to zoom.
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
    </Modal>
  );
};
