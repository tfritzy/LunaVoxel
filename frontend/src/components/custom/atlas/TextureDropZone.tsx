import { X, Upload } from "lucide-react";
import { useState, useRef } from "react";
import "@/components/custom/color-picker.css";

export const TextureDropZone = ({
  imageData,
  onImageData,
  onError,
  pixelWidth: cellSize,
}: {
  imageData: ImageData | null;
  onImageData: (data: ImageData | null) => void;
  onError: (error: string) => void;
  pixelWidth: number;
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

      if (img.width !== img.height) {
        onError("Texture must be square");
        return;
      }

      if (img.width > 128 || img.height > 128) {
        onError("Texture must be 128x128 pixels or smaller");
        return;
      }

      console.log(`Loaded image: ${img.width}x${img.height}`);
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      if (cellSize > 1 && (img.width !== cellSize || img.height !== cellSize)) {
        onError(
          `Texture must be exactly ${cellSize}x${cellSize} to be consistent with the rest of the atlas.`
        );
        return;
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
    console.log(
      "createAtlasCanvas - Created canvas with dimensions:",
      canvas.width,
      "x",
      canvas.height
    );
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL();
    }
    return null;
  };

  const texturePreview = renderTexturePreview();

  return (
    <div className="">
      <div
        className={`h-[190px] w-[190px] rounded-xs cursor-pointer
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
              {cellSize > 1
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
    </div>
  );
};
