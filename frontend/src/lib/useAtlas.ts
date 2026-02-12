import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGlobalState } from "@/state/store";

export interface AtlasData {
  blockAtlasMappings: number[];
  texture: THREE.Texture | null;
  colors: number[];
}

export const useAtlas = (): AtlasData => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const blocks = useGlobalState((state) => state.blocks);

  const atlasData = useMemo(() => {
    if (textureRef.current) {
      textureRef.current.dispose();
      textureRef.current = null;
    }

    if (!blocks.blockColors.length) {
      return { blockAtlasMappings: [], colors: [], texture: null };
    }

    const colors: number[] = [];
    const colorMap = new Map<number, number>();
    const blockAtlasMappings: number[] = [];

    for (let i = 0; i < blocks.blockColors.length; i++) {
      const color = blocks.blockColors[i];
      if (!colorMap.has(color)) {
        colorMap.set(color, colors.length);
        colors.push(color);
      }
      blockAtlasMappings.push(colorMap.get(color)!);
    }

    if (!colors.length) {
      return { blockAtlasMappings, colors, texture: null };
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      ctxRef.current = canvasRef.current.getContext("2d");
    }

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    if (!ctx) {
      return { blockAtlasMappings, colors, texture: null };
    }

    const requiredSlots = colors.length;
    const gridSize = getNextPowerOfTwo(Math.ceil(Math.sqrt(requiredSlots)));

    canvas.width = gridSize;
    canvas.height = gridSize;
    ctx.imageSmoothingEnabled = false;

    for (let i = 0; i < requiredSlots; i++) {
      const col = i % gridSize;
      const row = Math.floor(i / gridSize);

      ctx.fillStyle = `#${colors[i].toString(16).padStart(6, "0")}`;
      ctx.fillRect(col, row, 1, 1);
    }

    const texture = new THREE.Texture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    textureRef.current = texture;

    return { blockAtlasMappings, colors, texture };
  }, [blocks]);

  useEffect(() => {
    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, []);

  return atlasData;
};

const getNextPowerOfTwo = (n: number): number => {
  if (n <= 0) return 1;
  return Math.pow(2, Math.ceil(Math.log2(n)));
};
