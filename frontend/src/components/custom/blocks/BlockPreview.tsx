import { useBlockTextures } from "@/lib/useBlockTextures";
import { useAtlasContext } from "@/contexts/CurrentProjectContext";
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
  const { textureAtlas } = useAtlasContext();

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
        <svg
          width="42"
          height="42"
          viewBox="0 0 32 32"
          className="animate-pulse"
        >
          <polygon
            points="16,2 28,9 28,23 16,30 4,23 4,9"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="2"
            className="text-border"
          />
        </svg>
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
