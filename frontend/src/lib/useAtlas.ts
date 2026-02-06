import { useRef, useEffect, useMemo, useState } from "react";
import * as THREE from "three";

export interface AtlasData {
  blockAtlasMappings: number[][];
  texture: THREE.Texture | null;
  colors: number[];
}

const DEFAULT_COLORS = [
  0x8B4513, // brown
  0x228B22, // forest green
  0x808080, // gray
  0x87CEEB, // sky blue
  0xFFFF00, // yellow
  0xFF0000, // red
  0x800080, // purple
  0xFFA500, // orange
  0x00FFFF, // cyan
  0xFF69B4, // pink
];

const DEFAULT_BLOCK_MAPPINGS = [
  [0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2, 2],
  [3, 3, 3, 3, 3, 3],
  [4, 4, 4, 4, 4, 4],
  [5, 5, 5, 5, 5, 5],
  [6, 6, 6, 6, 6, 6],
  [7, 7, 7, 7, 7, 7],
  [8, 8, 8, 8, 8, 8],
  [9, 9, 9, 9, 9, 9],
];

export const useAtlas = (): AtlasData => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const [, forceUpdate] = useState(0);

  const atlasData = useMemo(() => {
    if (textureRef.current) {
      textureRef.current.dispose();
      textureRef.current = null;
    }

    const colors = DEFAULT_COLORS;
    const blockAtlasMappings = DEFAULT_BLOCK_MAPPINGS;

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
  }, []);

  useEffect(() => {
    forceUpdate(1);
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
