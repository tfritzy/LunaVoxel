import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { useBlockTextures } from "@/lib/useBlockTextures";
import { FileWarning } from "lucide-react";
import { useEffect, useState } from "react";

interface BlockPreviewProps {
  blockIndex: number;
}

export const BlockPreview = ({ blockIndex }: BlockPreviewProps) => {
  const { getBlockTexture, isReady } = useBlockTextures({
    textureSize: 256,
  });
  const [textureUrl, setTextureUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { textureAtlas } = useCurrentProject();

  useEffect(() => {
    if (!isReady) {
      setIsLoading(true);
      return;
    }

    const loadTexture = async () => {
      setIsLoading(true);
      try {
        const url = getBlockTexture(blockIndex);
        setTextureUrl(url);
      } catch (error) {
        console.error("Failed to load block texture:", error);
        setTextureUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadTexture();
  }, [blockIndex, getBlockTexture, isReady, textureAtlas]);

  if (isLoading) {
    return (
      <div className={"w-full h-full flex items-center justify-center"}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!textureUrl) {
    return (
      <div className={"w-full h-full flex items-center justify-center"}>
        <div className="text-gray-500 text-sm">
          <FileWarning />
        </div>
      </div>
    );
  }

  return (
    <div className={"w-full h-full"}>
      <img
        src={textureUrl}
        draggable={false}
        alt={"Block ${blockIndex}"}
        className="w-full h-full object-contain"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
};
