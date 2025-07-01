import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { X } from "lucide-react";
import { useState, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import { getFunctions, httpsCallable } from "firebase/functions";
import "@/components/custom/color-picker.css";
import { TextureDropZone } from "./TextureDropZone";
import { CubePreview } from "./Preview";

interface AtlasSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  index: number;
  cellSize: number;
  defaultTexture: ImageData | null;
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

const rgbToInt = (r: number, g: number, b: number): number => {
  return (r << 16) | (g << 8) | b;
};

const intToHex = (value: number): string => {
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

export const AtlasSlotModal = ({
  isOpen,
  onClose,
  projectId,
  index,
  cellSize,
  defaultTexture,
}: AtlasSlotModalProps) => {
  const [selectedColor, setSelectedColor] = useState<number>(0xffffff);
  const [selectedImageData, setSelectedImageData] = useState<ImageData | null>(
    null
  );
  const [fileError, setFileError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedColor(0xffffff);

      if (defaultTexture) {
        setSelectedImageData(defaultTexture);
      }
    }
  }, [isOpen, defaultTexture]);

  const handleImageData = (imageData: ImageData | null) => {
    setSelectedImageData(imageData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedColor && !selectedImageData) {
      return;
    }

    setIsSubmitting(true);

    try {
      const functions = getFunctions();
      const updateAtlas = httpsCallable(functions, "updateAtlas");

      let textureBase64 = "";
      let actualCellSize = cellSize;

      if (selectedImageData) {
        const canvas = document.createElement("canvas");
        canvas.width = selectedImageData.width;
        canvas.height = selectedImageData.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.putImageData(selectedImageData, 0, 0);
          textureBase64 = canvas.toDataURL("image/png").split(",")[1];
        }

        if (cellSize === -1) {
          actualCellSize = selectedImageData.width;
        }
      }

      await updateAtlas({
        projectId,
        index,
        texture: textureBase64,
        tint: selectedColor,
        cellSize: actualCellSize,
      });

      onClose();
    } catch (error) {
      console.error("Error updating atlas:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleColorChange = (color: string) => {
    const rgb = hexToRgb(color);
    const intColor = rgbToInt(rgb.r, rgb.g, rgb.b);
    setSelectedColor(intColor);
  };

  const handleClose = () => {
    onClose();
    setFileError("");
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} disableOutsideClick>
      <div className="bg-card rounded shadow-lg p-6 w-full max-w-lg border border-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Edit Atlas Slot {index}</h2>
          <Button onClick={handleClose} variant="ghost" size="sm">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <CubePreview color={selectedColor} texture={selectedImageData} />

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="flex flex-row space-x-4">
            <div>
              <div className="w-full text-center mb-1 text-sm text-muted-foreground">
                Color
              </div>
              <HexColorPicker
                color={intToHex(selectedColor)}
                onChange={handleColorChange}
                style={{ width: "150px", height: "150px" }}
              />
            </div>

            <div>
              <div className="w-full text-center mb-1 text-sm text-muted-foreground">
                Texture
              </div>
              <TextureDropZone
                onImageData={handleImageData}
                onError={setFileError}
                cellSize={cellSize}
                imageData={selectedImageData}
                error={fileError}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Slot"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
