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
  const [isReady, setIsReady] = useState<number>(0);

  const atlasDataRef = useRef(atlasData);
  const isReadyRef = useRef(isReady);

  atlasDataRef.current = atlasData;
  isReadyRef.current = isReady;

  useEffect(() => {
    if (!atlasData) {
      setIsReady(0);
      return;
    }

    try {
      rendererRef.current = getBlockTextureRenderer(atlasData, textureSize);
      setIsReady(isReady + 1);
    } catch (error) {
      console.error("Failed to get BlockTextureRenderer:", error);
      setIsReady(0);
    }

    return () => {
      if (rendererRef.current) {
        releaseBlockTextureRenderer();
        rendererRef.current = null;
      }
    };
  }, [atlasData, textureSize]);

  const getBlockTexture = useCallback((blockIndex: number): string | null => {
    if (!rendererRef.current || !atlasDataRef.current || !isReadyRef.current) {
      return null;
    }

    try {
      return rendererRef.current.renderBlockToTexture(
        blockIndex,
        atlasDataRef.current
      );
    } catch (error) {
      console.error("Failed to render block texture:", error);
      return null;
    }
  }, []);

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
