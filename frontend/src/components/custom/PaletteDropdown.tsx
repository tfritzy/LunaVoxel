import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { ChevronDown, Palette } from "lucide-react";
import { ColorPalette, colorPalettes } from "./colorPalettes";

interface PaletteDropdownProps {
  onPaletteSelect: (palette: ColorPalette) => void;
}

interface ColorPreviewProps {
  colors: string[];
  maxColors?: number;
}

const ColorPreview: React.FC<ColorPreviewProps> = ({
  colors,
  maxColors = 8,
}) => {
  const displayColors = colors.slice(0, maxColors);

  return (
    <div className="flex gap-0.5">
      <div className="border border-white/25">
        <div className="border border-black/25 flex flex-row">
          {displayColors.map((color, index) => (
            <div
              key={index}
              className="w-3 h-3 border border-border/50"
              style={{ backgroundColor: color }}
            />
          ))}
          {colors.length > maxColors && (
            <div className="w-3 h-3 border border-border/50 bg-muted flex items-center justify-center">
              <span className="text-[6px] text-muted-foreground">
                +{colors.length - maxColors}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  paletteName: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  paletteName,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 max-w-md">
        <h3 className="text-lg font-semibold mb-4">Replace Current Palette?</h3>
        <p className="text-muted-foreground mb-6">
          This will replace your current color palette with "{paletteName}".
          This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Replace Palette</Button>
        </div>
      </div>
    </Modal>
  );
};

export default function PaletteDropdown({
  onPaletteSelect,
}: PaletteDropdownProps) {
  const [selectedPalette, setSelectedPalette] = useState<ColorPalette | null>(
    null
  );
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handlePaletteClick = (palette: ColorPalette) => {
    setSelectedPalette(palette);
    setShowConfirmation(true);
  };

  const handleConfirm = () => {
    if (selectedPalette) {
      onPaletteSelect(selectedPalette);
    }
    setShowConfirmation(false);
    setSelectedPalette(null);
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setSelectedPalette(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full mb-2">
            <Palette className="w-4 h-4 mr-2" />
            Preset Palettes
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-64 max-h-80 overflow-y-auto"
        >
          {colorPalettes.map((palette) => (
            <DropdownMenuItem
              key={palette.name}
              className="flex flex-row items-center justify-between gap-2 p-3 cursor-pointer"
              onClick={() => handlePaletteClick(palette)}
            >
              <div className="font-medium text-sm">{palette.name}</div>
              <ColorPreview colors={palette.colors} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        paletteName={selectedPalette?.name || ""}
      />
    </>
  );
}
