import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useParams } from "react-router-dom";
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
  blockIndex: number | "new";
  atlasData: AtlasData;
}

export const BlockModal = ({
  isOpen,
  onClose,
  blockIndex,
  atlasData,
}: BlockModalProps) => {
  const projectId = useParams().projectId || "";
  const { connection } = useDatabase();
  const isNewBlock = blockIndex === "new";

  const defaultColor = "#ffffff";
  const [applyToAllFaces, setApplyToAllFaces] = useState(true);
  const [selectedColors, setSelectedColors] = useState<string[]>(() => {
    if (isNewBlock) {
      return Array(6).fill(defaultColor);
    } else {
      const blockAtlasIndices =
        atlasData.blockAtlasMappings?.[blockIndex as number];
      if (blockAtlasIndices) {
        return blockAtlasIndices.map(
          (atlasIndex) =>
            "#" + atlasData.colors[atlasIndex].toString(16).padStart(6, "0")
        );
      }
      return Array(6).fill(defaultColor);
    }
  });
  const [submitPending, setSubmitPending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isNewBlock) {
        setApplyToAllFaces(true);
        setSelectedColors(Array(6).fill(defaultColor));
      } else {
        const blockAtlasIndices =
          atlasData.blockAtlasMappings?.[blockIndex as number];
        if (blockAtlasIndices) {
          const existingColors = blockAtlasIndices.map(
            (atlasIndex) =>
              "#" + atlasData.colors[atlasIndex].toString(16).padStart(6, "0")
          );
          const allSame = existingColors.every(
            (color) => color === existingColors[0]
          );
          setApplyToAllFaces(allSame);
          setSelectedColors(existingColors);
        } else {
          setApplyToAllFaces(true);
          setSelectedColors(Array(6).fill(defaultColor));
        }
      }
    }
  }, [isOpen, blockIndex, isNewBlock, atlasData]);

  const handleApplyToAllChange = (checked: boolean | "indeterminate") => {
    const isApplyingAll = checked === false;
    setApplyToAllFaces(isApplyingAll);
    if (isApplyingAll) {
      setSelectedColors(Array(6).fill(selectedColors[0]));
    }
  };

  const handleColorChange = (color: string, faceIndex?: number) => {
    if (applyToAllFaces || faceIndex === undefined) {
      setSelectedColors(Array(6).fill(color));
    } else {
      const newColors = [...selectedColors];
      newColors[faceIndex] = color;
      setSelectedColors(newColors);
    }
  };

  const handleSubmit = () => {
    setSubmitPending(true);
    const colorNumbers = selectedColors.map((hex) =>
      parseInt(hex.replace("#", ""), 16)
    );

    if (isNewBlock) {
      connection?.reducers.addBlock(projectId, colorNumbers);
    } else {
      connection?.reducers.updateBlock(
        projectId,
        blockIndex as number,
        colorNumbers
      );
    }
    setSubmitPending(false);
    onClose();
  };

  const faceNames = ["Right", "Left", "Top", "Bottom", "Front", "Back"];
  const title = isNewBlock ? "Create New Block" : "Edit Block";

  const renderFaceColorPicker = (faceIndex: number) => (
    <div className="space-y-1 items-center flex flex-col">
      <label className="text-xs font-medium text-center block text-muted-foreground mb-2">
        {faceNames[faceIndex]}
      </label>
      <ColorPicker
        color={selectedColors[faceIndex]}
        onChange={(color) => handleColorChange(color, faceIndex)}
      />
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="5xl"
      footer={
        <div className="flex justify-end w-full">
          <div className="flex gap-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} pending={submitPending}>
              {isNewBlock ? "Create Block" : "Update Block"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="w-full h-[60vh] flex flex-col text-foreground">
        <div className="flex flex-1 overflow-hidden">
          <div className="">
            <div className="pr-6 h-full">
              <div className="flex flex-col h-full space-y-4">
                <div className="bg-background rounded-lg p-4 border border-border shadow-sm">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="apply-all"
                      checked={!applyToAllFaces}
                      onCheckedChange={handleApplyToAllChange}
                    />
                    <label
                      htmlFor="apply-all"
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      Specify face colors individually
                    </label>
                  </div>
                </div>

                <div className="bg-background rounded-lg p-6 flex flex-col border border-border shadow-sm flex-1 overflow-y-auto">
                  <div className="mb-6">
                    <p className="text-sm text-muted-foreground">
                      {applyToAllFaces
                        ? "Select a color to apply to all faces of the block."
                        : "Select a color for each face of the block."}
                    </p>
                  </div>

                  {applyToAllFaces ? (
                    <div className="flex justify-center">
                      <ColorPicker
                        color={selectedColors[0]}
                        onChange={(color) => handleColorChange(color)}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-8 justify-items-center">
                      {renderFaceColorPicker(2)}
                      {renderFaceColorPicker(1)}
                      {renderFaceColorPicker(4)}
                      {renderFaceColorPicker(0)}
                      {renderFaceColorPicker(3)}
                      {renderFaceColorPicker(5)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="w-3xl flex flex-col rounded-lg border border-border">
            <Block3DPreview faceColors={selectedColors} />
          </div>
        </div>
      </div>
    </Modal>
  );
};
