import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { AtlasTextureDropdown } from "./AtlasTextureDropdown";
import { BlockFacePreview } from "./BlockFacePreview";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useDatabase } from "@/contexts/DatabaseContext";

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
  const { blocks, project } = useCurrentProject();
  const [applyToAllFaces, setApplyToAllFaces] = useState(true);
  const [selectedFaces, setSelectedFaces] = useState<number[]>(() => {
    if (isNewBlock || blockIndex === undefined) {
      return [0, 0, 0, 0, 0, 0];
    }
    return blocks.blockFaceAtlasIndexes[blockIndex] || [0, 0, 0, 0, 0, 0];
  });
  const { connection } = useDatabase();

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
    connection?.reducers.updateBlock(project.id, blockIndex, selectedFaces, 0);
    onClose();
  };

  const handleEditAtlas = () => {
    console.log("Navigate to atlas editor");
  };

  const faceNames = ["Right", "Left", "Top", "Bottom", "Front", "Back"];
  const title = isNewBlock ? "Create New Block" : "Edit Block";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="5xl"
      footer={
        <div className="flex justify-between w-full">
          <Button
            variant="outline"
            onClick={handleEditAtlas}
            className="flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Edit Atlas
          </Button>
          <div className="flex gap-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
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
                      checked={applyToAllFaces}
                      onCheckedChange={(checked) =>
                        setApplyToAllFaces(checked === true)
                      }
                    />
                    <label
                      htmlFor="apply-all"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Specify face mappings individually
                    </label>
                  </div>
                </div>

                {applyToAllFaces ? (
                  <div className="flex-1 flex flex-col">
                    <div className="bg-background rounded-lg p-6 border border-border shadow-sm flex-1 flex flex-col space-y-4">
                      <div className="">
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          Single atlas coordinate for all faces
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6">
                          This atlas coordinate will be applied to all faces of
                          the block.
                        </p>
                      </div>
                      <AtlasTextureDropdown
                        selectedTexture={selectedFaces[0]}
                        onSelect={(textureIndex) =>
                          handleFaceChange(0, textureIndex)
                        }
                        size="lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    <div className="bg-background rounded-lg p-6 border border-border shadow-sm flex-1">
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          Individual coordinate for each face
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Select an atlas coordinate for each face of the block.
                        </p>
                      </div>

                      <div className="grid grid-cols-4 gap-4">
                        <div />
                        <div className="space-y-1 items-center flex flex-col">
                          <label className="text-xs font-medium text-center block text-muted-foreground">
                            {faceNames[2]}
                          </label>
                          <AtlasTextureDropdown
                            selectedTexture={selectedFaces[2]}
                            onSelect={(textureIndex) =>
                              handleFaceChange(2, textureIndex)
                            }
                          />
                        </div>
                        <div />
                        <div />

                        <div className="space-y-1 items-center flex flex-col">
                          <label className="text-xs font-medium text-center block text-muted-foreground">
                            {faceNames[1]}
                          </label>
                          <AtlasTextureDropdown
                            selectedTexture={selectedFaces[1]}
                            onSelect={(textureIndex) =>
                              handleFaceChange(1, textureIndex)
                            }
                          />
                        </div>

                        <div className="space-y-1 items-center flex flex-col">
                          <label className="text-xs font-medium text-center block text-muted-foreground">
                            {faceNames[4]}
                          </label>
                          <AtlasTextureDropdown
                            selectedTexture={selectedFaces[4]}
                            onSelect={(textureIndex) =>
                              handleFaceChange(4, textureIndex)
                            }
                          />
                        </div>

                        <div className="space-y-1 items-center flex flex-col">
                          <label className="text-xs font-medium text-center block text-muted-foreground">
                            {faceNames[0]}
                          </label>
                          <AtlasTextureDropdown
                            selectedTexture={selectedFaces[0]}
                            onSelect={(textureIndex) =>
                              handleFaceChange(0, textureIndex)
                            }
                          />
                        </div>

                        <div className="space-y-1 items-center flex flex-col">
                          <label className="text-xs font-medium text-center block text-muted-foreground">
                            {faceNames[5]}
                          </label>
                          <AtlasTextureDropdown
                            selectedTexture={selectedFaces[5]}
                            onSelect={(textureIndex) =>
                              handleFaceChange(5, textureIndex)
                            }
                          />
                        </div>

                        <div />
                        <div className="space-y-1 items-center flex flex-col">
                          <label className="text-xs font-medium text-center block text-muted-foreground">
                            {faceNames[3]}
                          </label>
                          <AtlasTextureDropdown
                            selectedTexture={selectedFaces[3]}
                            onSelect={(textureIndex) =>
                              handleFaceChange(3, textureIndex)
                            }
                          />
                        </div>
                        <div />
                        <div />
                      </div>
                    </div>
                  </div>
                )}
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
