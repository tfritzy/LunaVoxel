import { useCallback, useEffect, useRef, useState } from "react";
import {
  getBlockTextureRenderer,
  releaseBlockTextureRenderer,
} from "./blockTextureRenderer";
import { AtlasData } from "./useAtlas";

export const useBlockTextures = (
  atlasData: AtlasData,
  textureSize?: number
) => {
  const rendererRef = useRef<ReturnType<typeof getBlockTextureRenderer> | null>(
    null
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!atlasData) {
      setIsReady(false);
      return;
    }

    try {
      rendererRef.current = getBlockTextureRenderer(atlasData, textureSize);
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
  }, [atlasData, textureSize]);

  const getBlockTexture = useCallback(
    (blockIndex: number): string | null => {
      if (!rendererRef.current || !atlasData || !isReady) {
        return null;
      }

      try {
        return rendererRef.current.renderBlockToTexture(blockIndex, atlasData);
      } catch (error) {
        console.error("Failed to render block texture:", error);
        return null;
      }
    },
    [atlasData, isReady]
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
