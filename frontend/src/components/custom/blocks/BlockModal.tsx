import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useParams } from "react-router-dom";
import { HexColorPicker } from "react-colorful";
import "@/components/custom/color-picker.css";
import { Block3DPreview } from "./Block3dPreview";
import { AtlasData } from "@/lib/useAtlas";
import { reducers } from "@/state";

const computeTextColor = (hex: string): string => {
  const cleaned = hex.replace("#", "");
  const red = parseInt(cleaned.substring(0, 2), 16);
  const green = parseInt(cleaned.substring(2, 4), 16);
  const blue = parseInt(cleaned.substring(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 128 ? "#000000" : "#ffffff";
};

const validateHexColor = (hex: string): boolean => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
};

export const ColorPicker = ({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) => {
  const [textInput, setTextInput] = useState(color);

  useEffect(() => {
    if (validateHexColor(color)) {
      setTextInput(color);
    }
  }, [color]);

  const onPickerChange = (newVal: string) => {
    onChange(newVal);
    setTextInput(newVal);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTextInput(val);
    if (validateHexColor(val)) {
      onChange(val);
    }
  };

  const onInputBlur = () => {
    if (!validateHexColor(textInput)) {
      setTextInput(color);
    }
  };

  const onInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const txtColor = computeTextColor(validateHexColor(textInput) ? textInput : color);
  const bgColor = validateHexColor(textInput) ? textInput : color;

  return (
    <div className={`relative`}>
      <HexColorPicker color={color} onChange={onPickerChange} />
      <input
        type="text"
        value={textInput}
        onChange={onInputChange}
        onBlur={onInputBlur}
        onFocus={onInputFocus}
        className="w-full mt-2 text-xs py-2 font-mono text-center border border-border rounded"
        style={{ backgroundColor: bgColor, color: txtColor }}
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
  const isCreating = blockIndex === "new";

  const initialColor = "#ffffff";
  const [uniformColors, setUniformColors] = useState(true);
  const [faceColors, setFaceColors] = useState<string[]>(() => {
    if (isCreating) {
      return Array(6).fill(initialColor);
    }
    const mappings = atlasData.blockAtlasMappings?.[(blockIndex as number) - 1];
    if (mappings) {
      return mappings.map(idx => "#" + atlasData.colors[idx].toString(16).padStart(6, "0"));
    }
    return Array(6).fill(initialColor);
  });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isCreating) {
        setUniformColors(true);
        setFaceColors(Array(6).fill(initialColor));
      } else {
        const mappings = atlasData.blockAtlasMappings?.[(blockIndex as number) - 1];
        if (mappings) {
          const cols = mappings.map(idx => "#" + atlasData.colors[idx].toString(16).padStart(6, "0"));
          const allMatch = cols.every(c => c === cols[0]);
          setUniformColors(allMatch);
          setFaceColors(cols);
        } else {
          setUniformColors(true);
          setFaceColors(Array(6).fill(initialColor));
        }
      }
    }
  }, [isOpen, blockIndex, isCreating, atlasData]);

  const onUniformToggle = (checked: boolean | "indeterminate") => {
    const useUniform = checked === false;
    setUniformColors(useUniform);
    if (useUniform) {
      setFaceColors(Array(6).fill(faceColors[0]));
    }
  };

  const onColorUpdate = (col: string, faceIdx?: number) => {
    if (uniformColors || faceIdx === undefined) {
      setFaceColors(Array(6).fill(col));
    } else {
      const updated = [...faceColors];
      updated[faceIdx] = col;
      setFaceColors(updated);
    }
  };

  const onSave = () => {
    setPending(true);
    const nums = faceColors.map(hex => parseInt(hex.replace("#", ""), 16));

    if (isCreating) {
      reducers.addBlock(projectId, nums);
    } else {
      reducers.updateBlock(projectId, (blockIndex as number) - 1, nums);
    }
    setPending(false);
    onClose();
  };

  const faceLabels = ["Right", "Left", "Top", "Bottom", "Front", "Back"];
  const modalTitle = isCreating ? "Create New Block" : "Edit Block";

  const renderFacePicker = (idx: number) => (
    <div className="space-y-1 items-center flex flex-col">
      <label className="text-muted-foreground mb-2">{faceLabels[idx]}</label>
      <ColorPicker
        color={faceColors[idx]}
        onChange={(c) => onColorUpdate(c, idx)}
      />
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="5xl"
      footer={
        <div className="flex justify-end w-full">
          <div className="flex gap-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={onSave} pending={pending}>
              {isCreating ? "Create Block" : "Update Block"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="w-full h-[50vh] flex flex-col text-foreground relative">
        <div className="absolute max-h-full pb-4 pt-2 px-4 h-full overflow-y-auto">
          <div className="pr-6 h-full">
            <div className="flex flex-col h-full space-y-4">
              <div className="rounded-lg p-4 border border-border shadow-sm">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="individual-faces"
                    checked={!uniformColors}
                    onCheckedChange={onUniformToggle}
                  />
                  <label htmlFor="individual-faces" className="text-sm font-medium leading-none cursor-pointer">
                    Individual face colors
                  </label>
                </div>
              </div>

              <div className="rounded-lg p-6 flex flex-col border border-border shadow-sm flex-1 overflow-y-auto bg-background">
                {uniformColors ? (
                  <div className="flex justify-center">
                    <ColorPicker color={faceColors[0]} onChange={(c) => onColorUpdate(c)} />
                  </div>
                ) : (
                  <div className="flex flex-col space-y-8 justify-items-center">
                    {renderFacePicker(2)}
                    {renderFacePicker(1)}
                    {renderFacePicker(4)}
                    {renderFacePicker(0)}
                    {renderFacePicker(3)}
                    {renderFacePicker(5)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <Block3DPreview faceColors={faceColors} camRadius={8} />
      </div>
    </Modal>
  );
};
