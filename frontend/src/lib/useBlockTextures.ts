import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAtlasContext,
  useBlocksContext,
} from "@/contexts/CurrentProjectContext";
import {
  getBlockTextureRenderer,
  releaseBlockTextureRenderer,
} from "./blockTextureRenderer";

interface UseBlockTexturesOptions {
  textureSize?: number;
}

export const useBlockTextures = (options: UseBlockTexturesOptions = {}) => {
  const { atlas, textureAtlas } = useAtlasContext();
  const { blocks } = useBlocksContext();

  const rendererRef = useRef<ReturnType<typeof getBlockTextureRenderer> | null>(
    null
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!atlas || !textureAtlas || !blocks) {
      setIsReady(false);
      return;
    }

    try {
      rendererRef.current = getBlockTextureRenderer({
        atlas,
        textureAtlas,
        blocks,
        textureSize: options.textureSize,
      });
      setIsReady(true);
    } catch (error) {
      console.error("Failed to get BlockTextureRenderer:", error);
      setIsReady(false);
    }

    return () => {
      if (rendererRef.current) {
        releaseBlockTextureRenderer();
        rendererRef.current = null;
      }
    };
  }, [atlas, textureAtlas, blocks, options.textureSize]);

  const getBlockTexture = useCallback(
    (blockIndex: number): string | null => {
      if (!rendererRef.current || !atlas || !blocks || !isReady) {
        return null;
      }

      try {
        return rendererRef.current.renderBlockToTexture(
          blockIndex,
          atlas,
          blocks
        );
      } catch (error) {
        console.error("Failed to render block texture:", error);
        return null;
      }
    },
    [atlas, blocks, isReady]
  );

  const clearCache = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.clearCache();
    }
  }, []);

  return {
    getBlockTexture,
    clearCache,
    isReady,
  };
};
