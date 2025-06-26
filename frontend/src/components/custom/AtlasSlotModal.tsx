import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { X, Upload, Palette } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { HexColorPicker } from "react-colorful";
import { getFunctions, httpsCallable } from "firebase/functions";
import "@/components/custom/color-picker.css";

interface AtlasSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  index: number;
  cellSize: number;
}

const formSchema = z
  .object({
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
      .optional(),
    texture: z.instanceof(File).optional(),
  })
  .refine((data) => data.color || data.texture, {
    message: "Either color or texture must be provided",
  });

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

export const AtlasSlotModal = ({
  isOpen,
  onClose,
  projectId,
  index,
  cellSize,
}: AtlasSlotModalProps) => {
  const [selectedColor, setSelectedColor] = useState<string>("#ffffff");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      color: undefined,
      texture: undefined,
    },
  });

  const validateImageDimensions = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const isValid = img.width === cellSize && img.height === cellSize;
        if (!isValid) {
          setFileError(`Image must be ${cellSize}x${cellSize} pixels`);
        }
        resolve(isValid);
      };
      img.onerror = () => {
        setFileError("Invalid image file");
        resolve(false);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileError("");

    if (!file.type.startsWith("image/")) {
      setFileError("Please select an image file");
      return;
    }

    const isValidDimensions = await validateImageDimensions(file);
    if (isValidDimensions) {
      setSelectedFile(file);
      form.setValue("texture", file);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);

    try {
      const functions = getFunctions();
      const updateAtlas = httpsCallable(functions, "updateAtlas");

      let textureBase64 = "";
      if (values.texture) {
        textureBase64 = await fileToBase64(values.texture);
      }

      let tintValue = "";
      if (values.color) {
        const rgb = hexToRgb(values.color);
        tintValue = rgbToInt(rgb.r, rgb.g, rgb.b).toString();
      }

      await updateAtlas({
        projectId,
        index,
        texture: textureBase64,
        tint: tintValue,
      });

      onClose();
      form.reset();
      setSelectedFile(null);
      setSelectedColor("#ffffff");
    } catch (error) {
      console.error("Error updating atlas:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    form.setValue("color", color);
  };

  const handleClose = () => {
    onClose();
    form.reset();
    setSelectedFile(null);
    setSelectedColor("#ffffff");
    setFileError("");
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="bg-card rounded-lg shadow-lg p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Edit Atlas Slot {index}</h2>
          <Button onClick={handleClose} variant="ghost" size="sm">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="color"
                render={() => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Color (optional)
                    </FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        <Input
                          value={selectedColor}
                          onChange={(e) => handleColorChange(e.target.value)}
                          placeholder="#ffffff"
                        />
                        <div className="w-full max-w-xs mx-auto">
                          <HexColorPicker
                            color={selectedColor}
                            onChange={handleColorChange}
                            style={{ width: "100%", height: "200px" }}
                          />
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="texture"
                render={() => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Texture (optional)
                    </FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                        />
                        <p className="text-xs text-muted-foreground">
                          Required dimensions: {cellSize}x{cellSize} pixels
                        </p>
                        {fileError && (
                          <p className="text-xs text-destructive">
                            {fileError}
                          </p>
                        )}
                        {selectedFile && (
                          <p className="text-xs text-green-600">
                            ✓ {selectedFile.name}
                          </p>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
        </Form>
      </div>
    </Modal>
  );
};
