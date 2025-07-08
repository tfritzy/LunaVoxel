import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { AtlasTextureDropdown } from "./AtlasTextureDropdown";
import { BlockFacePreview } from "./BlockFacePreview";
import { Checkbox } from "@radix-ui/react-checkbox";

interface BlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockIndex: number;
  isNewBlock?: boolean;
}

export const BlockModal = ({
  isOpen,
  onClose,
  blockIndex,
  isNewBlock = false,
}: BlockModalProps) => {
  const { blocks } = useCurrentProject();
  const [applyToAllFaces, setApplyToAllFaces] = useState(true);
  const [selectedFaces, setSelectedFaces] = useState<number[]>(() => {
    if (isNewBlock || blockIndex === undefined) {
      return [0, 0, 0, 0, 0, 0];
    }
    return blocks.blockFaceAtlasIndexes[blockIndex] || [0, 0, 0, 0, 0, 0];
  });

  const handleFaceChange = (faceIndex: number, textureIndex: number) => {
    if (applyToAllFaces) {
      setSelectedFaces(Array(6).fill(textureIndex));
    } else {
      const newFaces = [...selectedFaces];
      newFaces[faceIndex] = textureIndex;
      setSelectedFaces(newFaces);
    }
  };

  const handleSubmit = () => {
    console.log("Block submission:", {
      blockIndex: isNewBlock ? "new" : blockIndex,
      faces: selectedFaces,
      applyToAllFaces,
    });
    onClose();
  };

  const faceNames = ["Right", "Left", "Top", "Bottom", "Front", "Back"];

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="max-w-11/12 w-full h-[80vh] flex flex-col text-foreground">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {isNewBlock ? "Create New Block" : "Edit Block"}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-lg p-6 border-r overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="apply-all"
                  checked={applyToAllFaces}
                  onCheckedChange={(checked) =>
                    setApplyToAllFaces(checked === true)
                  }
                />
                <label
                  htmlFor="apply-all"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Apply to all faces
                </label>
              </div>

              {applyToAllFaces ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Texture</label>
                  <AtlasTextureDropdown
                    selectedTexture={selectedFaces[0]}
                    onSelect={(textureIndex) =>
                      handleFaceChange(0, textureIndex)
                    }
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Individual Faces</h3>
                  <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
                    <div></div>
                    <div className="space-y-1">
                      <label className="text-xs text-center block">
                        {faceNames[2]}
                      </label>
                      <AtlasTextureDropdown
                        selectedTexture={selectedFaces[2]}
                        onSelect={(textureIndex) =>
                          handleFaceChange(2, textureIndex)
                        }
                        size="small"
                      />
                    </div>
                    <div></div>
                    <div></div>

                    <div className="space-y-1">
                      <label className="text-xs text-center block">
                        {faceNames[1]}
                      </label>
                      <AtlasTextureDropdown
                        selectedTexture={selectedFaces[1]}
                        onSelect={(textureIndex) =>
                          handleFaceChange(1, textureIndex)
                        }
                        size="small"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-center block">
                        {faceNames[4]}
                      </label>
                      <AtlasTextureDropdown
                        selectedTexture={selectedFaces[4]}
                        onSelect={(textureIndex) =>
                          handleFaceChange(4, textureIndex)
                        }
                        size="small"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-center block">
                        {faceNames[0]}
                      </label>
                      <AtlasTextureDropdown
                        selectedTexture={selectedFaces[0]}
                        onSelect={(textureIndex) =>
                          handleFaceChange(0, textureIndex)
                        }
                        size="small"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-center block">
                        {faceNames[5]}
                      </label>
                      <AtlasTextureDropdown
                        selectedTexture={selectedFaces[5]}
                        onSelect={(textureIndex) =>
                          handleFaceChange(5, textureIndex)
                        }
                        size="small"
                      />
                    </div>

                    <div></div>
                    <div className="space-y-1">
                      <label className="text-xs text-center block">
                        {faceNames[3]}
                      </label>
                      <AtlasTextureDropdown
                        selectedTexture={selectedFaces[3]}
                        onSelect={(textureIndex) =>
                          handleFaceChange(3, textureIndex)
                        }
                        size="small"
                      />
                    </div>
                    <div></div>
                    <div></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="w-3xl p-6 flex flex-col">
            <div className="flex-1 flex items-center justify-center">
              <BlockFacePreview faces={selectedFaces} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-6 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {isNewBlock ? "Create Block" : "Update Block"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
