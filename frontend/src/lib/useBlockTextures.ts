import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  getBlockTextureRenderer,
  releaseBlockTextureRenderer,
} from "./blockTextureRenderer";

export const useBlockTextures = (
  textureAtlas: THREE.Texture,
  blockFaceAtlases: number[][],
  textureSize?: number
) => {
  const rendererRef = useRef<ReturnType<typeof getBlockTextureRenderer> | null>(
    null
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!textureAtlas || !blockFaceAtlases) {
      setIsReady(false);
      return;
    }

    try {
      rendererRef.current = getBlockTextureRenderer(
        textureAtlas,
        blockFaceAtlases,
        textureSize
      );
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
  }, [textureAtlas, blockFaceAtlases, textureSize]);

  const getBlockTexture = useCallback(
    (blockIndex: number): string | null => {
      if (!rendererRef.current || !blockFaceAtlases || !isReady) {
        return null;
      }

      try {
        return rendererRef.current.renderBlockToTexture(
          blockIndex,
          textureAtlas,
          blockFaceAtlases
        );
      } catch (error) {
        console.error("Failed to render block texture:", error);
        return null;
      }
    },
    [blockFaceAtlases, isReady, textureAtlas]
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
