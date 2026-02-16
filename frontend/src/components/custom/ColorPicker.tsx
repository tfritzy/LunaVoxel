import { HexColorPicker } from "react-colorful";
import { useEffect, useRef, useState } from "react";
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
  onChangeComplete,
}: {
  color: string;
  onChange: (color: string) => void;
  onChangeComplete?: (color: string) => void;
}) => {
  const [inputValue, setInputValue] = useState(color);
  const colorBeforeDragRef = useRef<string>(color);
  const isDraggingRef = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isValidHex(color)) {
      setInputValue(color);
    }
  }, [color]);

  useEffect(() => {
    if (!isDraggingRef.current) {
      colorBeforeDragRef.current = color;
    }
  }, [color]);

  useEffect(() => {
    const el = pickerRef.current;
    if (!el) return;

    const handleMouseDown = () => {
      isDraggingRef.current = true;
      colorBeforeDragRef.current = color;
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        onChangeComplete?.(colorBeforeDragRef.current);
      }
    };

    el.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      el.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [color, onChangeComplete]);

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
    } else {
      onChangeComplete?.(colorBeforeDragRef.current);
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    colorBeforeDragRef.current = color;
    e.target.select();
  };

  const textColor = getTextColor(isValidHex(inputValue) ? inputValue : color);
  const backgroundColor = isValidHex(inputValue) ? inputValue : color;

  return (
    <div className="w-full">
      <div ref={pickerRef}>
        <HexColorPicker color={color} onChange={handleColorChange} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div
          className="w-10 h-10 rounded-md border border-border shrink-0 shadow-sm"
          style={{ backgroundColor }}
        />
        <input
          type="text"
          value={inputValue}
          onChange={handleHexInputChange}
          onBlur={handleInputBlur}
          onFocus={handleInputFocus}
          className="flex-1 h-10 px-3 text-sm font-mono text-center bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background transition-shadow"
          style={{
            color: "inherit",
          }}
          placeholder="#ffffff"
        />
      </div>
    </div>
  );
};
