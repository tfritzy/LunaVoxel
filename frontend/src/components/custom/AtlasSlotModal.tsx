import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { X, Upload } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { HexColorPicker } from "react-colorful";
import { getFunctions, httpsCallable } from "firebase/functions";
import "@/components/custom/color-picker.css";
import * as THREE from "three";

interface AtlasSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  index: number;
  cellSize: number;
  defaultTint: number;
  defaultTexture: ImageData | null;
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

const rgbToInt = (r: number, g: number, b: number): number => {
  return (r << 16) | (g << 8) | b;
};

const intToHex = (value: number): string => {
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

const CubePreview = ({
  color,
  texture,
}: {
  color: number;
  texture: ImageData | null;
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    cube: THREE.Mesh;
    material: THREE.MeshLambertMaterial;
  } | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const containerWidth = mountRef.current.clientWidth;
    const width = containerWidth;
    const height = width * 0.7;
    const aspectRatio = width / height;
    const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    camera.position.set(1, 0.75, 1);
    camera.lookAt(0, -0.1, 0);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const ambientLight = new THREE.AmbientLight(0x404040, 1);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: color });
    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = true;
    scene.add(cube);
    mountRef.current.appendChild(renderer.domElement);
    sceneRef.current = { scene, camera, renderer, cube, material };
    lastTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      if (!sceneRef.current) return;
      requestAnimationFrame(animate);

      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      const rotationSpeed = 0.001;
      sceneRef.current.cube.rotation.y += rotationSpeed * deltaTime;

      sceneRef.current.renderer.render(
        sceneRef.current.scene,
        sceneRef.current.camera
      );
    };
    animate(performance.now());
    return () => {
      if (sceneRef.current) {
        mountRef.current?.removeChild(sceneRef.current.renderer.domElement);
        sceneRef.current.renderer.dispose();
      }
    };
  }, []);
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.material.color.setHex(color);
  }, [color]);
  useEffect(() => {
    if (!sceneRef.current) return;
    if (texture) {
      const canvas = document.createElement("canvas");
      canvas.width = texture.width;
      canvas.height = texture.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.putImageData(texture, 0, 0);
        const threeTexture = new THREE.CanvasTexture(canvas);
        threeTexture.minFilter = THREE.NearestFilter;
        threeTexture.magFilter = THREE.NearestFilter;
        sceneRef.current.material.map = threeTexture;
        sceneRef.current.material.needsUpdate = true;
      }
    } else {
      sceneRef.current.material.map = null;
      sceneRef.current.material.needsUpdate = true;
    }
  }, [texture]);
  return (
    <div
      ref={mountRef}
      className="rounded-xs overflow-hidden border border-border"
    />
  );
};

const TextureDropZone = ({
  onImageData,
  onError,
  cellSize,
  imageData,
  error,
}: {
  onImageData: (data: ImageData | null) => void;
  onError: (error: string) => void;
  cellSize: number;
  imageData: ImageData | null;
  error: string;
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      onError("File is not an image");
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        onError("Failed to get canvas context");
        return;
      }

      if (cellSize === -1) {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      } else {
        canvas.width = cellSize;
        canvas.height = cellSize;
        ctx.drawImage(img, 0, 0, cellSize, cellSize);
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      onImageData(imageData);
    };
    img.onerror = () => {
      onError("Failed to load image");
    };
    img.src = URL.createObjectURL(file);
    return null;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemoveTexture = (e: React.MouseEvent) => {
    e.stopPropagation();
    onImageData(null);
  };

  const renderTexturePreview = () => {
    if (!imageData) return null;

    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL();
    }
    return null;
  };

  const texturePreview = renderTexturePreview();

  return (
    <div className="space-y-2">
      <div
        className={`
          w-[150px] h-[150px] rounded-xs cursor-pointer
          flex flex-col items-center justify-center
          transition-colors duration-200 relative
          ${
            texturePreview
              ? `${
                  isDragOver
                    ? "border-2 border-dashed border-primary bg-primary/10"
                    : ""
                }`
              : `border-2 border-dashed ${
                  isDragOver
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`
          }
          ${texturePreview ? "p-0" : "p-4"}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {texturePreview ? (
          <>
            <img
              src={texturePreview}
              alt="Texture preview"
              className="w-full h-full object-cover rounded-xs pixelated"
              style={{ imageRendering: "pixelated" }}
            />
            {isHovered && (
              <button
                onClick={handleRemoveTexture}
                className="absolute top-1 right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </>
        ) : (
          <>
            <Upload className="w-6 h-6 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground text-center mb-1">
              Drop texture here
            </p>
            <p className="text-xs text-muted-foreground text-center">
              {cellSize > 0
                ? `${cellSize}x${cellSize} pixels`
                : "Any square size"}
            </p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export const AtlasSlotModal = ({
  isOpen,
  onClose,
  projectId,
  index,
  cellSize,
  defaultTint,
  defaultTexture,
}: AtlasSlotModalProps) => {
  const [selectedColor, setSelectedColor] = useState<number>(defaultTint);
  const [selectedImageData, setSelectedImageData] = useState<ImageData | null>(
    null
  );
  const [fileError, setFileError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (defaultTint !== undefined) {
        setSelectedColor(defaultTint);
      }

      if (defaultTexture) {
        setSelectedImageData(defaultTexture);
      }
    }
  }, [isOpen, defaultTint, defaultTexture]);

  const handleImageData = (imageData: ImageData | null) => {
    setSelectedImageData(imageData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedColor && !selectedImageData) {
      return;
    }

    setIsSubmitting(true);

    try {
      const functions = getFunctions();
      const updateAtlas = httpsCallable(functions, "updateAtlas");

      let textureBase64 = "";
      let actualCellSize = cellSize;

      if (selectedImageData) {
        const canvas = document.createElement("canvas");
        canvas.width = selectedImageData.width;
        canvas.height = selectedImageData.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.putImageData(selectedImageData, 0, 0);
          textureBase64 = canvas.toDataURL("image/png").split(",")[1];
        }

        if (cellSize === -1) {
          actualCellSize = selectedImageData.width;
        }
      }

      await updateAtlas({
        projectId,
        index,
        texture: textureBase64,
        tint: selectedColor,
        cellSize: actualCellSize,
      });

      onClose();
    } catch (error) {
      console.error("Error updating atlas:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleColorChange = (color: string) => {
    const rgb = hexToRgb(color);
    const intColor = rgbToInt(rgb.r, rgb.g, rgb.b);
    setSelectedColor(intColor);
  };

  const handleClose = () => {
    onClose();
    setFileError("");
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="bg-card rounded shadow-lg p-6 w-full max-w-lg border border-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Edit Atlas Slot {index}</h2>
          <Button onClick={handleClose} variant="ghost" size="sm">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <CubePreview color={selectedColor} texture={selectedImageData} />

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="flex flex-row space-x-4">
            <div>
              <div className="w-full text-center mb-1 text-sm text-muted-foreground">
                Color
              </div>
              <HexColorPicker
                color={intToHex(selectedColor)}
                onChange={handleColorChange}
                style={{ width: "150px", height: "150px" }}
              />
            </div>

            <div>
              <div className="w-full text-center mb-1 text-sm text-muted-foreground">
                Texture
              </div>
              <TextureDropZone
                onImageData={handleImageData}
                onError={setFileError}
                cellSize={cellSize}
                imageData={selectedImageData}
                error={fileError}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Slot"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
