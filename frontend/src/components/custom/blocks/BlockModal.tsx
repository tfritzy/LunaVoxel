// src/components/BlockModal.tsx

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { AtlasTextureDropdown } from "./AtlasTextureDropdown";
import { BlockFacePreview } from "./BlockFacePreview";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useDatabase } from "@/contexts/DatabaseContext";

interface BlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockIndex: number | "new";
}

export const BlockModal = ({
  isOpen,
  onClose,
  blockIndex,
}: BlockModalProps) => {
  const isNewBlock = blockIndex === "new";
  const { blocks, project } = useCurrentProject();
  const [applyToAllFaces, setApplyToAllFaces] = useState(true);
  const [selectedFaces, setSelectedFaces] = useState<number[]>(() =>
    isNewBlock
      ? [0, 0, 0, 0, 0, 0]
      : blocks.blockFaceAtlasIndexes[blockIndex] || [0, 0, 0, 0, 0, 0]
  );
  const [submitPending, setSubmitPending] = useState(false);
  const { connection } = useDatabase();

  useEffect(() => {
    if (isOpen) {
      if (isNewBlock) {
        setApplyToAllFaces(true);
        setSelectedFaces([0, 0, 0, 0, 0, 0]);
      } else {
        const existingFaces = blocks.blockFaceAtlasIndexes[blockIndex] || [
          0, 0, 0, 0, 0, 0,
        ];
        const allSame = existingFaces.every(
          (index) => index === existingFaces[0]
        );
        setApplyToAllFaces(allSame);
        setSelectedFaces(existingFaces);
      }
    }
  }, [isOpen, blockIndex, blocks.blockFaceAtlasIndexes]);

  const handleFaceChange = (faceIndex: number, textureIndex: number) => {
    if (applyToAllFaces) {
      setSelectedFaces(Array(6).fill(textureIndex));
    } else {
      const newFaces = [...selectedFaces];
      newFaces[faceIndex] = textureIndex;
      setSelectedFaces(newFaces);
    }
  };

  const handleApplyToAllChange = (checked: boolean | "indeterminate") => {
    const isApplyingAll = checked === false;
    setApplyToAllFaces(isApplyingAll);
    if (isApplyingAll) {
      setSelectedFaces(Array(6).fill(selectedFaces[0]));
    }
  };

  const handleSubmit = () => {
    setSubmitPending(true);
    if (isNewBlock) {
      connection?.reducers.addBlock(project.id, selectedFaces);
    } else {
      connection?.reducers.updateBlock(
        project.id,
        blockIndex as number,
        selectedFaces
      );
    }
    setSubmitPending(false);
    onClose();
  };

  const faceNames = ["Right", "Left", "Top", "Bottom", "Front", "Back"];
  const title = isNewBlock ? "Create New Block" : "Edit Block";

  const renderFaceSelector = (faceIndex: number) => (
    <div className="space-y-1 items-center flex flex-col">
      <label className="text-xs font-medium text-center block text-muted-foreground">
        {faceNames[faceIndex]}
      </label>
      <AtlasTextureDropdown
        selectedTexture={selectedFaces[faceIndex]}
        onSelect={(textureIndex) => handleFaceChange(faceIndex, textureIndex)}
        isLinked={applyToAllFaces}
      />
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="5xl"
      footer={
        <div className="flex justify-end w-full">
          <div className="flex gap-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} pending={submitPending}>
              {isNewBlock ? "Create Block" : "Update Block"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="w-full h-[60vh] flex flex-col text-foreground">
        <div className="flex flex-1 overflow-hidden">
          <div className="w-lg overflow-y-auto">
            <div className="pr-6 h-full">
              <div className="flex flex-col h-full space-y-4">
                <div className="bg-background rounded-lg p-4 border border-border shadow-sm">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="apply-all"
                      checked={!applyToAllFaces}
                      onCheckedChange={handleApplyToAllChange}
                    />
                    <label
                      htmlFor="apply-all"
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      Specify face mappings individually
                    </label>
                  </div>
                </div>

                <div className="bg-background rounded-lg p-6 flex flex-col border border-border shadow-sm flex-1">
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {applyToAllFaces
                        ? "Single atlas coordinate for all faces"
                        : "Individual coordinate for each face"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {applyToAllFaces
                        ? "Select a texture to apply to all linked faces."
                        : "Select a mapping for each face of the block."}
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-4 items-center">
                    <div />
                    {renderFaceSelector(2)}
                    <div />
                    <div />

                    {renderFaceSelector(1)}
                    {renderFaceSelector(4)}
                    {renderFaceSelector(0)}
                    {renderFaceSelector(5)}

                    <div />
                    {renderFaceSelector(3)}
                    <div />
                    <div />
                  </div>

                  <div className="text-foreground-muted mt-auto pt-6">
                    To edit or add more texture options, you need to edit the
                    texture atlas.
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="w-3xl flex flex-col rounded-lg border border-border">
            <div className="flex-1 flex items-center justify-center">
              <BlockFacePreview
                faces={selectedFaces}
                showLabels={!applyToAllFaces}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
