import { useState, useCallback } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Link, Unlink } from "lucide-react";
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
  const [linked, setLinked] = useState(true);
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

  const handleDimensionChange = useCallback((axis: keyof Vector3, value: string) => {
    if (value !== "" && !/^\d+$/.test(value)) return;
    if (linked) {
      setDimText({ x: value, y: value, z: value });
    } else {
      setDimText((prev) => ({ ...prev, [axis]: value }));
    }
  }, [linked]);

  const handleBlur = useCallback((axis: keyof Vector3) => {
    const parsed = parseDim(dimText[axis]);
    if (parsed === null) {
      if (linked) {
        const fallback = String(currentDimensions[axis]);
        setDimText({ x: fallback, y: fallback, z: fallback });
      } else {
        setDimText((prev) => ({ ...prev, [axis]: String(currentDimensions[axis]) }));
      }
    }
  }, [dimText, currentDimensions, linked]);

  const handleSubmit = () => {
    onResize(dimensions, anchor);
    onClose();
  };

  const unchanged =
    dimensions.x === currentDimensions.x &&
    dimensions.y === currentDimensions.y &&
    dimensions.z === currentDimensions.z;

  const inputClass =
    "w-full h-8 rounded border border-border bg-background px-2 text-sm text-center text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/50";

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
      <div className="px-6 pb-4 space-y-3">
        <div className="flex items-center gap-2">
          {(["x", "y", "z"] as const).map((axis, i) => (
            <div key={axis} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground text-xs">×</span>}
              <div className="w-20">
                <label
                  htmlFor={`resize-dim-${axis}`}
                  className="text-[10px] text-muted-foreground uppercase block text-center mb-0.5"
                >
                  {axis}
                </label>
                <input
                  id={`resize-dim-${axis}`}
                  type="text"
                  inputMode="numeric"
                  value={dimText[axis]}
                  onChange={(e) => handleDimensionChange(axis, e.target.value)}
                  onBlur={() => handleBlur(axis)}
                  className={inputClass}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLinked((l) => !l)}
            className="ml-1 p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={linked ? "Unlink dimensions" : "Link dimensions"}
          >
            {linked ? <Link className="w-3.5 h-3.5" /> : <Unlink className="w-3.5 h-3.5" />}
          </button>
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
