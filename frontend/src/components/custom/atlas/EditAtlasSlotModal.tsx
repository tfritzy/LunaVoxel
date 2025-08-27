import { Modal } from "@/components/ui/modal";
import { useEffect, useState } from "react";
import { TextureDropZone } from "./TextureDropZone";
import { ColorPicker } from "../ColorPicker";
import React from "react";
import { AtlasSlot } from "@/lib/useAtlas";
import { X, Palette, Image, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFunctions, httpsCallable } from "firebase/functions";
import { SelectionCard } from "./SelectionCard";
import { functions } from "@/firebase/firebase";
import { useAtlasContext } from "@/contexts/CurrentProjectContext";
import { useParams } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useQueryRunner } from "@/lib/useQueryRunner";
import { DbConnection, ProjectBlocks } from "@/module_bindings";
import { useCallback, useMemo } from "react";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { createColorTexture, getColorFromTextureData } from "./texture-utils";

type SelectionMode = "color" | "texture";

export const EditAtlasSlotModal = ({
  index,
  isOpen,
  onClose,
}: {
  index: number | "new";
  isOpen: boolean;
  onClose: () => void;
}) => {
  const projectId = useParams().projectId || "";
  const { atlas, atlasSlots } = useAtlasContext();
  const { connection } = useDatabase();
  const getTable = useCallback((db: DbConnection) => db.db.projectBlocks, []);
  const { data: allBlocks } = useQueryRunner<ProjectBlocks>(
    connection,
    getTable
  );
  const blocks = allBlocks[0];
  const [selectedColor, setSelectedColor] = useState<string>("#ffffff");
  const [textureData, setTextureData] = useState<ImageData | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("color");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [createNewBlock, setCreateNewBlock] = useState(true);

  const slot: AtlasSlot | null = index !== "new" ? atlasSlots[index] : null;
  const isAdd = index === "new";

  const blocksUsingSlot = useMemo(() => {
    if (!blocks || isAdd) return 0;

    let count = 0;
    blocks.blockFaceAtlasIndexes.forEach((blockFaces) => {
      if (blockFaces.some((faceIndex) => faceIndex === index)) {
        count++;
      }
    });
    return count;
  }, [blocks, index, isAdd]);

  useEffect(() => {
    if (!slot) {
      setSelectedColor("#ffffff");
      setTextureData(null);
      setSelectionMode("color");
      setCreateNewBlock(true);
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

  const handleDeleteClick = () => {
    setShowDeleteConfirmation(true);
  };

  const handleDeleteConfirm = React.useCallback(async () => {
    setIsSubmitting(true);
    const deleteAtlasIndex = httpsCallable(functions, "deleteAtlasIndex");
    const willBeNoRemainingTextures =
      atlasSlots
        .filter((slot) => slot && slot.index !== index)
        .filter((slot) => !slot.isSolidColor).length === 0;
    const newCellPixelSize = willBeNoRemainingTextures
      ? 1
      : atlas.cellPixelWidth;

    try {
      await deleteAtlasIndex({
        projectId: projectId,
        index,
        targetCellPixelSize: newCellPixelSize,
        currentGridSize: atlas.gridSize,
        currentUsedSlots: atlas.usedSlots,
      });
    } catch {
      setError("Failed to delete the atlas slot. Please try again.");
      setIsSubmitting(false);
      setShowDeleteConfirmation(false);
      return;
    }

    setIsSubmitting(false);
    setShowDeleteConfirmation(false);
    onClose();
  }, [
    atlas.cellPixelWidth,
    atlas.gridSize,
    atlas.usedSlots,
    atlasSlots,
    index,
    onClose,
    projectId,
  ]);

  const handleDeleteCancel = () => {
    setShowDeleteConfirmation(false);
  };

  const handleSubmit = React.useCallback(async () => {
    setIsSubmitting(true);
    const functions = getFunctions();

    let textureBase64 = "";

    if (selectionMode === "color") {
      const textureSize = atlas.cellPixelWidth;
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
          projectId: projectId,
          texture: textureBase64,
          targetCellPixelSize: textureData?.width || atlas.cellPixelWidth,
          currentUsedSlots: atlas.usedSlots,
          currentGridSize: atlas.gridSize,
        });

        if (createNewBlock) {
          const newAtlasIndex = atlas.usedSlots;
          const blockFaces = Array(6).fill(newAtlasIndex);
          connection?.reducers.addBlock(projectId, blockFaces);
        }
      } else {
        const updateAtlasIndex = httpsCallable(functions, "updateAtlasIndex");
        await updateAtlasIndex({
          projectId: projectId,
          index,
          texture: textureBase64,
          targetCellPixelSize: textureData?.width || atlas.cellPixelWidth,
          currentUsedSlots: atlas.usedSlots,
          currentGridSize: atlas.gridSize,
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
    atlas.cellPixelWidth,
    atlas.usedSlots,
    atlas.gridSize,
    selectedColor,
    index,
    projectId,
    createNewBlock,
    connection,
  ]);

  const isSubmitDisabled =
    (selectionMode === "color" && selectedColor === "#ffffff") ||
    (selectionMode === "texture" && !textureData) ||
    isSubmitting;

  const title = isAdd
    ? "Add Texture to Atlas"
    : `Edit Atlas Index ${index + 1}`;
  const submitButtonText = isAdd ? "Add to Atlas" : "Update Atlas";

  if (showDeleteConfirmation) {
    return (
      <DeleteConfirmationModal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isSubmitting={isSubmitting}
        blocksUsingSlot={blocksUsingSlot}
      />
    );
  }

  const footer = (
    <div className="flex flex-row justify-between items-center w-full px-2">
      {!isAdd && (
        <Button variant="outline" onClick={handleDeleteClick}>
          <Trash className="h-4 w-4" />
          Delete
        </Button>
      )}
      {isAdd && <div />}

      <div className="flex items-center justify-end space-x-3">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          pending={isSubmitting}
        >
          {submitButtonText}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      title={title}
      footer={footer}
    >
      <div className="flex flex-col min-h-0 pt-2">
        <div className="flex-1">
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
                  pixelWidth={atlas.cellPixelWidth}
                />
              </SelectionCard>
            </div>

            {isAdd && (
              <div className="bg-background rounded-lg p-4 border border-border shadow-sm">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="create-block"
                    checked={createNewBlock}
                    onCheckedChange={(checked) =>
                      setCreateNewBlock(checked === true)
                    }
                  />
                  <label
                    htmlFor="create-block"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Create new block with this texture on all sides
                  </label>
                </div>
              </div>
            )}

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
      </div>
    </Modal>
  );
};
