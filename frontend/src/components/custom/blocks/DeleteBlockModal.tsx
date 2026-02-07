import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AtlasData } from "@/lib/useAtlas";
import { useBlockTextures } from "@/lib/useBlockTextures";
import { X, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { stateStore } from "@/state/store";

interface DeleteBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockIndex: number;
  atlasData: AtlasData;
  projectId: string;
}

export const DeleteBlockModal = ({
  isOpen,
  onClose,
  blockIndex,
  atlasData,
  projectId,
}: DeleteBlockModalProps) => {
  const [submitPending, setSubmitPending] = useState(false);
  const { getBlockTexture, isReady } = useBlockTextures(atlasData, 256);

  const calculateDefaultReplacement = (
    blockNum: number,
    total: number
  ): number => {
    if (total <= 1) return 0;
    if (blockNum === total) return blockNum - 1;
    return blockNum + 1;
  };
  const [replacementBlockType, setReplacementBlockType] = useState<number>(0);

  useEffect(() => {
    setReplacementBlockType(
      calculateDefaultReplacement(
        blockIndex,
        atlasData.blockAtlasMappings.length
      )
    );
  }, [isOpen]);

  const blockCount = useMemo(() => {
    // Note: With sparse octree storage, counting blocks would require
    // traversing every leaf across all layers. For now, we'll return 0
    // which means we can't show the exact count.
    
    return 0;
  }, [blockIndex]);

  const handleDelete = () => {
    setSubmitPending(true);
    stateStore.reducers.deleteBlock(
      projectId,
      blockIndex,
      replacementBlockType
    );
    setSubmitPending(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={"Delete Block " + blockIndex}
      size="md"
      footer={
        <div className="flex justify-end w-full">
          <div className="flex gap-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              pending={submitPending}
              variant="destructive"
            >
              Delete Block
            </Button>
          </div>
        </div>
      }
    >
      <div className="w-full px-6 py-4">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this block? This action cannot be
            undone.
          </p>

          {blockCount > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {blockCount} block{blockCount !== 1 ? "s" : ""} in the scene
                will be replaced with:
              </p>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-16 px-4"
                  >
                    <div className="flex items-center gap-3">
                      {replacementBlockType === 0 ? (
                        <>
                          <div className="w-12 h-12 flex items-center justify-center bg-muted/50 rounded">
                            <X className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <span>Empty (remove)</span>
                        </>
                      ) : replacementBlockType > 0 && isReady ? (
                        <>
                          <div className="w-12 h-12 flex items-center justify-center rounded overflow-hidden">
                            <img
                              src={getBlockTexture(replacementBlockType - 1) ?? undefined}
                              alt=""
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span>Block {replacementBlockType}</span>
                        </>
                      ) : (
                        <div className="w-12 h-12 flex items-center justify-center bg-muted/50 rounded" />
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-64 max-h-80 overflow-y-auto"
                >
                  <DropdownMenuItem
                    onClick={() => setReplacementBlockType(0)}
                    className="h-12"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-10 h-10 flex items-center justify-center bg-muted/50 rounded">
                        <X className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span>Empty (remove)</span>
                    </div>
                  </DropdownMenuItem>

                  {atlasData.blockAtlasMappings.map((_, index) => {
                    const blockNum = index + 1;
                    if (blockNum === blockIndex) return null;

                    return (
                      <DropdownMenuItem
                        key={blockNum}
                        onClick={() => setReplacementBlockType(blockNum)}
                        className="h-12"
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className="w-10 h-10 flex items-center justify-center rounded overflow-hidden">
                            {isReady && (
                              <img
                                src={getBlockTexture(index) ?? undefined}
                                alt=""
                                className="w-full h-full object-contain"
                              />
                            )}
                          </div>
                          <span>Block {blockNum}</span>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This block is not currently used in the scene.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
