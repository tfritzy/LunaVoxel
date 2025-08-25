import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { Atlas, DbConnection } from "@/module_bindings";
import { ref, getDownloadURL } from "firebase/storage";
import { useDatabase } from "@/contexts/DatabaseContext";
import { storage } from "@/firebase/firebase";
import { useQueryRunner } from "./useQueryRunner";

export interface AtlasSlot {
  index: number;
  textureData: ImageData | null;
  blobUrl: string | null;
  isEmpty: boolean;
  isSolidColor: boolean;
}

interface UseAtlasDataReturn {
  atlas: Atlas | null;
  atlasSlots: AtlasSlot[];
  textureAtlas: THREE.Texture | null;
  isLoading: boolean;
  error: string | null;
  totalSlots: number;
}

export const useAtlasData = (projectId: string): UseAtlasDataReturn => {
  const { connection } = useDatabase();
  const getTable = useCallback((db: DbConnection) => db.db.atlas, []);
  const { data: atlasData } = useQueryRunner<Atlas>(
    connection,
    `SELECT * FROM atlas WHERE ProjectId='${projectId}'`,
    getTable
  );

  const atlas = atlasData.length > 0 ? atlasData[0] : null;

  const [allSlots, setAllSlots] = useState<AtlasSlot[]>([]);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastVersionRef = useRef<number>(-1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const createThreeTexture = (image: HTMLImageElement): THREE.Texture => {
    const threeTexture = new THREE.Texture(image);
    threeTexture.magFilter = THREE.NearestFilter;
    threeTexture.minFilter = THREE.NearestFilter;
    threeTexture.wrapS = THREE.ClampToEdgeWrapping;
    threeTexture.wrapT = THREE.ClampToEdgeWrapping;
    threeTexture.generateMipmaps = false;
    threeTexture.needsUpdate = true;
    return threeTexture;
  };

  const isSolidColorImageData = (imageData: ImageData): boolean => {
    const data = imageData.data;
    if (data.length === 0) return false;

    const firstR = data[0];
    const firstG = data[1];
    const firstB = data[2];
    const firstA = data[3];

    for (let i = 4; i < data.length; i += 4) {
      if (
        data[i] !== firstR ||
        data[i + 1] !== firstG ||
        data[i + 2] !== firstB ||
        data[i + 3] !== firstA
      ) {
        return false;
      }
    }

    return true;
  };

  const initializeCanvas = (cellSize: number) => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      ctxRef.current = canvasRef.current.getContext("2d");
    }

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    if (!ctx) return false;

    if (canvas.width !== cellSize || canvas.height !== cellSize) {
      canvas.width = cellSize;
      canvas.height = cellSize;
      ctx.imageSmoothingEnabled = false;
    }

    return true;
  };

  const extractSlotsFromImage = useCallback(
    async (
      texture: THREE.Texture | null,
      cellSize: number
    ): Promise<AtlasSlot[]> => {
      const totalSlots = atlas?.usedSlots || 0;
      const extractedSlots: AtlasSlot[] = [];

      if (!texture?.image || !cellSize || !initializeCanvas(cellSize)) {
        for (let i = 0; i < totalSlots; i++) {
          extractedSlots.push({
            index: i,
            textureData: null,
            blobUrl: null,
            isEmpty: true,
            isSolidColor: false,
          });
        }
        return extractedSlots;
      }

      const canvas = canvasRef.current!;
      const ctx = ctxRef.current!;
      const image = texture.image as HTMLImageElement;
      const gridSize = Math.floor(image.width / cellSize);

      for (let i = 0; i < totalSlots; i++) {
        const col = i % gridSize;
        const row = Math.floor(i / gridSize);
        const x = col * cellSize;
        const y = row * cellSize;

        if (x + cellSize > image.width || y + cellSize > image.height) {
          extractedSlots.push({
            index: i,
            textureData: null,
            blobUrl: null,
            isEmpty: true,
            isSolidColor: false,
          });
          continue;
        }

        ctx.clearRect(0, 0, cellSize, cellSize);
        ctx.drawImage(
          image,
          x,
          y,
          cellSize,
          cellSize,
          0,
          0,
          cellSize,
          cellSize
        );

        const imageData = ctx.getImageData(0, 0, cellSize, cellSize);
        const isEmpty = imageData.data.every((value, index) =>
          index % 4 === 3 ? value === 0 : true
        );

        const isSolidColor = isEmpty ? false : isSolidColorImageData(imageData);

        let blobUrl: string | null = null;
        if (!isEmpty) {
          const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, "image/png");
          });
          if (blob) {
            blobUrl = URL.createObjectURL(blob);
          }
        }

        extractedSlots.push({
          index: i,
          textureData: isEmpty ? null : imageData,
          blobUrl,
          isEmpty,
          isSolidColor,
        });
      }

      return extractedSlots;
    },
    [atlas]
  );

  const downloadAtlasImage = useCallback(
    async (version: number) => {
      try {
        setIsLoading(true);
        setError(null);

        const atlasRef = ref(storage, `atlases/${projectId}.png`);

        try {
          const downloadUrl = await getDownloadURL(atlasRef);

          const image = new Image();
          image.crossOrigin = "anonymous";

          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = reject;
            image.src = downloadUrl;
          });

          setTexture(createThreeTexture(image));
        } catch {
          setTexture(null);
        }

        lastVersionRef.current = version;
      } catch (err) {
        console.error("Failed to download atlas image:", err);
        setError("Failed to load atlas image");
        setTexture(null);
      } finally {
        setIsLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    if (atlas && atlas.version !== lastVersionRef.current) {
      downloadAtlasImage(atlas.version);
    }
  }, [atlas, downloadAtlasImage]);

  useEffect(() => {
    if (atlas && texture) {
      extractSlotsFromImage(texture, atlas.cellPixelWidth).then(setAllSlots);
    } else {
      setAllSlots([]);
    }
  }, [atlas, texture, extractSlotsFromImage]);

  useEffect(() => {
    return () => {
      allSlots.forEach((slot) => {
        if (slot.blobUrl) {
          URL.revokeObjectURL(slot.blobUrl);
        }
      });

      if (canvasRef.current) {
        canvasRef.current = null;
        ctxRef.current = null;
      }
    };
  }, [allSlots]);

  useEffect(() => {
    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, [texture]);

  const nonEmptySlots = allSlots.filter((slot) => !slot.isEmpty);

  return {
    atlas,
    atlasSlots: nonEmptySlots,
    textureAtlas: texture,
    isLoading,
    error,
    totalSlots: atlas?.usedSlots || 0,
  };
};
