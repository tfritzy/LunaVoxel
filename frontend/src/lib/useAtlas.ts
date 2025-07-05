import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { Atlas, EventContext } from "@/module_bindings";
import { ref, getDownloadURL } from "firebase/storage";
import { useDatabase } from "@/contexts/DatabaseContext";
import { storage } from "@/firebase/firebase";

export interface AtlasSlot {
  index: number;
  textureData: ImageData | null;
  blobUrl: string | null;
  isEmpty: boolean;
  isSolidColor: boolean;
}

interface UseAtlasReturn {
  atlas: Atlas | null;
  slots: AtlasSlot[];
  texture: THREE.Texture | null;
  isLoading: boolean;
  error: string | null;
  totalSlots: number;
}

export const useAtlas = (projectId: string): UseAtlasReturn => {
  const { connection } = useDatabase();
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [allSlots, setAllSlots] = useState<AtlasSlot[]>([]);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastVersionRef = useRef<number>(-1);

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

  const extractSlotsFromImage = async (
    texture: THREE.Texture | null,
    cellSize: number
  ): Promise<AtlasSlot[]> => {
    const totalSlots = atlas?.size || 0;
    const extractedSlots: AtlasSlot[] = [];

    for (let i = 0; i < totalSlots; i++) {
      if (!texture?.image || !cellSize) {
        extractedSlots.push({
          index: i,
          textureData: null,
          blobUrl: null,
          isEmpty: true,
          isSolidColor: false,
        });
        continue;
      }

      const image = texture.image as HTMLImageElement;
      const gridSize = Math.floor(image.width / cellSize);
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

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        extractedSlots.push({
          index: i,
          textureData: null,
          blobUrl: null,
          isEmpty: true,
          isSolidColor: false,
        });
        continue;
      }

      canvas.width = cellSize;
      canvas.height = cellSize;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, x, y, cellSize, cellSize, 0, 0, cellSize, cellSize);

      const imageData = ctx.getImageData(0, 0, cellSize, cellSize);
      const isEmpty = imageData.data.every((value, index) =>
        index % 4 === 3 ? value === 0 : true
      );

      const isSolidColor = isEmpty ? false : isSolidColorImageData(imageData);

      let blobUrl: string | null = null;
      if (!isEmpty) {
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve);
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
  };

  const downloadAtlasImage = async (version: number) => {
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
  };

  useEffect(() => {
    if (!connection || !projectId) return;

    const subscription = connection
      .subscriptionBuilder()
      .onApplied(() => {
        const atlasRow = connection.db.atlas.project_id.find(projectId);
        if (atlasRow) {
          setAtlas(atlasRow);
          if (atlasRow.version !== lastVersionRef.current) {
            downloadAtlasImage(atlasRow.version);
          }
        }
      })
      .onError((error) => {
        console.error("Atlas subscription error:", error);
        setError("Failed to subscribe to atlas");
      })
      .subscribe([`SELECT * FROM atlas WHERE ProjectId='${projectId}'`]);

    const onAtlasUpdate = (
      ctx: EventContext,
      oldAtlas: Atlas,
      newAtlas: Atlas
    ) => {
      if (newAtlas.projectId === projectId) {
        setAtlas(newAtlas);
        if (newAtlas.version !== lastVersionRef.current) {
          downloadAtlasImage(newAtlas.version);
        }
      }
    };

    const onAtlasInsert = (ctx: EventContext, newAtlas: Atlas) => {
      if (newAtlas.projectId === projectId) {
        setAtlas(newAtlas);
        downloadAtlasImage(newAtlas.version);
      }
    };

    connection.db.atlas.onUpdate(onAtlasUpdate);
    connection.db.atlas.onInsert(onAtlasInsert);

    return () => {
      subscription.unsubscribe();
      connection.db.atlas.removeOnUpdate(onAtlasUpdate);
      connection.db.atlas.removeOnInsert(onAtlasInsert);
    };
  }, [connection, projectId]);

  useEffect(() => {
    allSlots.forEach((slot) => {
      if (slot.blobUrl) {
        URL.revokeObjectURL(slot.blobUrl);
      }
    });

    if (atlas && texture) {
      extractSlotsFromImage(texture, atlas.cellSize).then(setAllSlots);
    } else {
      setAllSlots([]);
    }
  }, [atlas, texture]);

  useEffect(() => {
    return () => {
      allSlots.forEach((slot) => {
        if (slot.blobUrl) {
          URL.revokeObjectURL(slot.blobUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, []);

  const nonEmptySlots = allSlots.filter((slot) => !slot.isEmpty);

  return {
    atlas,
    slots: nonEmptySlots,
    texture,
    isLoading,
    error,
    totalSlots: atlas?.size || 0,
  };
};
