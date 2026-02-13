import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { stateStore, useGlobalState } from "@/state/store";
import { HexColorPicker } from "react-colorful";
import "@/components/custom/color-picker.css";
import { Block3DPreview } from "./Block3dPreview";
import { AtlasData } from "@/lib/useAtlas";

const getTextColor = (hexColor: string): string => {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? "#000000" : "#ffffff";
};

const isValidHex = (hex: string): boolean => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
};

export const ColorPicker = ({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) => {
  const [inputValue, setInputValue] = useState(color);

  useEffect(() => {
    if (isValidHex(color)) {
      setInputValue(color);
    }
  }, [color]);

  const handleColorChange = (newColor: string) => {
    onChange(newColor);
    setInputValue(newColor);
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (isValidHex(value)) {
      onChange(value);
    }
  };

  const handleInputBlur = () => {
    if (!isValidHex(inputValue)) {
      setInputValue(color);
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const textColor = getTextColor(isValidHex(inputValue) ? inputValue : color);
  const backgroundColor = isValidHex(inputValue) ? inputValue : color;

  return (
    <div className={`relative`}>
      <HexColorPicker color={color} onChange={handleColorChange} />
      <input
        type="text"
        value={inputValue}
        onChange={handleHexInputChange}
        onBlur={handleInputBlur}
        onFocus={handleInputFocus}
        className="w-full mt-2 text-xs py-2 font-mono text-center border border-border rounded"
        style={{
          backgroundColor,
          color: textColor,
        }}
        placeholder="#ffffff"
      />
    </div>
  );
};

interface BlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockIndex: number;
  atlasData: AtlasData;
}

export const BlockModal = ({
  isOpen,
  onClose,
  blockIndex,
  atlasData,
}: BlockModalProps) => {
  const projectId = useGlobalState((state) => state.project.id);

  const defaultColor = "#ffffff";
  const [selectedColor, setSelectedColor] = useState<string>(() => {
    const atlasIndex = atlasData.blockAtlasMapping?.[blockIndex - 1];
    if (atlasIndex !== undefined) {
      return "#" + atlasData.colors[atlasIndex].toString(16).padStart(6, "0");
    }
    return defaultColor;
  });
  const [submitPending, setSubmitPending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const atlasIndex = atlasData.blockAtlasMapping?.[blockIndex - 1];
      if (atlasIndex !== undefined) {
        setSelectedColor(
          "#" + atlasData.colors[atlasIndex].toString(16).padStart(6, "0")
        );
      } else {
        setSelectedColor(defaultColor);
      }
    }
  }, [isOpen, blockIndex, atlasData]);

  const handleSubmit = () => {
    setSubmitPending(true);
    const colorNumber = parseInt(selectedColor.replace("#", ""), 16);

    stateStore.reducers.updateBlock(projectId, blockIndex - 1, colorNumber);
    setSubmitPending(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Block"
      size="2xl"
      footer={
        <div className="flex justify-end w-full">
          <div className="flex gap-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} pending={submitPending}>
              Update Block
            </Button>
          </div>
        </div>
      }
    >
      <div className="w-full h-[50vh] flex flex-col text-foreground relative">
        <div className="absolute max-h-full pb-4 pt-2 px-4 h-full overflow-y-auto">
          <div className="pr-6 h-full">
            <div className="flex flex-col h-full space-y-4">
              <div className="rounded-lg p-6 flex flex-col border border-border shadow-sm flex-1 overflow-y-auto bg-background">
                <div className="flex justify-center">
                  <ColorPicker
                    color={selectedColor}
                    onChange={setSelectedColor}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <Block3DPreview color={selectedColor} camRadius={8} />
      </div>
    </Modal>
  );
};
