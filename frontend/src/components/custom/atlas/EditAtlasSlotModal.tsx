import { Modal } from "@/components/ui/modal";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { useEffect, useState } from "react";
import { TextureDropZone } from "./TextureDropZone";
import { ColorPicker } from "../ColorPicker";
import React from "react";
import { AtlasSlot } from "@/lib/useAtlas";
import { X, Palette, Image, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFunctions, httpsCallable } from "firebase/functions";
import { SelectionCard } from "./SelectionCard";

type SelectionMode = "color" | "texture";

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 255, g: 255, b: 255 };
};

const createColorTexture = (color: string, size: number): string => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  const rgb = hexToRgb(color);
  const imageData = ctx.createImageData(size, size);

  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = rgb.r;
    imageData.data[i + 1] = rgb.g;
    imageData.data[i + 2] = rgb.b;
    imageData.data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png").split(",")[1];
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

const getColorFromTextureData = (textureData: ImageData): string => {
  const data = textureData.data;
  const r = data[0];
  const g = data[1];
  const b = data[2];

  return rgbToHex(r, g, b);
};

export const EditAtlasSlotModal = ({
  index,
  isOpen,
  onClose,
}: {
  index: number | "new";
  isOpen: boolean;
  onClose: () => void;
}) => {
  const { atlas, atlasSlots, project } = useCurrentProject();
  const [selectedColor, setSelectedColor] = useState<string>("#ffffff");
  const [textureData, setTextureData] = useState<ImageData | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("color");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slot: AtlasSlot | null = index !== "new" ? atlasSlots[index] : null;
  const isAdd = index === "new";

  useEffect(() => {
    if (!slot) {
      setSelectedColor("#ffffff");
      setTextureData(null);
      setSelectionMode("color");
      return;
    }

    if (slot.isSolidColor) {
      const color = slot.textureData
        ? getColorFromTextureData(slot.textureData)
        : "#ffffff";
      setSelectedColor(color);
      setTextureData(null);
      setSelectionMode("color");
    } else {
      setSelectedColor("#ffffff");
      setTextureData(slot.textureData);
      setSelectionMode("texture");
    }
  }, [slot]);

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
  };

  const handleImageDataChange = React.useCallback((data: ImageData | null) => {
    setTextureData(data);
    setError(null);
  }, []);

  const handleError = React.useCallback((error: string) => {
    setError(error);
  }, []);

  const handleSelectionModeChange = (mode: SelectionMode) => {
    setSelectionMode(mode);
    setError(null);
  };

  const handleDismissError = () => {
    setError(null);
  };

  const handleSubmit = React.useCallback(async () => {
    setIsSubmitting(true);
    const functions = getFunctions();

    let textureBase64 = "";

    if (selectionMode === "color") {
      const textureSize = atlas.cellSize;
      textureBase64 = createColorTexture(selectedColor, textureSize);
    } else if (selectionMode === "texture" && textureData) {
      const canvas = document.createElement("canvas");
      canvas.width = textureData.width;
      canvas.height = textureData.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.putImageData(textureData, 0, 0);
        textureBase64 = canvas.toDataURL("image/png").split(",")[1];
      }
    }

    try {
      if (index === "new") {
        const addToAtlas = httpsCallable(functions, "addToAtlas");
        await addToAtlas({
          projectId: project.id,
          texture: textureBase64,
          cellSize: textureData?.width || atlas.cellSize,
          atlasSize: atlas.size,
        });
      } else {
        const updateAtlasIndex = httpsCallable(functions, "updateAtlasIndex");
        await updateAtlasIndex({
          projectId: project.id,
          index,
          texture: textureBase64,
          cellSize: textureData?.width || atlas.cellSize,
          atlasSize: atlas.size,
        });
      }
    } catch {
      setError("Failed to update the atlas. Please try again.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onClose();
  }, [
    selectionMode,
    textureData,
    onClose,
    atlas.cellSize,
    atlas.size,
    selectedColor,
    index,
    project.id,
  ]);

  const isSubmitDisabled =
    (selectionMode === "color" && selectedColor === "#ffffff") ||
    (selectionMode === "texture" && !textureData) ||
    isSubmitting;

  const title = isAdd
    ? "Add Texture to Atlas"
    : `Edit Atlas Index ${index + 1}`;
  const submitButtonText = isAdd ? "Add to Atlas" : "Update Atlas";

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col min-h-0">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">{title}</h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <SelectionCard
                isSelected={selectionMode === "color"}
                onSelect={() => handleSelectionModeChange("color")}
                icon={Palette}
                title="Solid Color"
                description="Use a single color"
              >
                <ColorPicker
                  color={selectedColor}
                  onChange={handleColorChange}
                />
              </SelectionCard>

              <SelectionCard
                isSelected={selectionMode === "texture"}
                onSelect={() => handleSelectionModeChange("texture")}
                icon={Image}
                title="Texture"
                description="Upload an image"
              >
                <TextureDropZone
                  imageData={textureData}
                  onImageData={handleImageDataChange}
                  onError={handleError}
                  cellSize={atlas.cellSize}
                />
              </SelectionCard>
            </div>

            {error && (
              <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-md flex items-start justify-between">
                <span className="flex-1">{error}</span>
                <Button
                  onClick={handleDismissError}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 ml-2 text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
            {isSubmitting && <Loader2 className="animate-spin h-4 w-4" />}
            {submitButtonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
