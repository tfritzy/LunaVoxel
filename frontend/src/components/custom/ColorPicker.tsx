import { HexColorPicker } from "react-colorful";
import { useEffect, useState } from "react";
import "@/components/custom/color-picker.css";

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
      <div className="w-full aspect-square">
        <HexColorPicker color={color} onChange={handleColorChange} />
      </div>
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
