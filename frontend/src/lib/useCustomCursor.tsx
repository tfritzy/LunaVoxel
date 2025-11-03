import { useState, useEffect } from "react";
import type { ToolType } from "@/modeling/lib/tool-type";

const loadSvgAsCursor = async (
  svgPath: string,
  scale: number = 0.8
): Promise<string> => {
  try {
    const response = await fetch(svgPath);
    let svgContent = await response.text();

    svgContent = svgContent.replace(
      /<svg([^>]*)>([\s\S]*)<\/svg>/,
      (match, attributes, content) => {
        return `<svg${attributes}>
          <g transform="scale(${scale})">
            ${content}
          </g>
        </svg>`;
      }
    );

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
  } catch (error) {
    console.warn(`Failed to load cursor SVG: ${svgPath}`, error);
    return "";
  }
};

const getCursorConfig = (
  mode: ToolType
): { path: string; hotspot: [number, number]; scale: number } => {
  switch (mode.tag) {
    case "BlockPicker":
      return {
        path: "/src/assets/drawing_picker.svg",
        hotspot: [4, 4],
        scale: 0.7,
      };
    case "MagicSelect":
      return {
        path: "/src/assets/tool_wand.svg",
        hotspot: [4, 2],
        scale: 0.7,
      };
    case "Rect":
    default:
      return {
        path: "/src/assets/cursor_none.svg",
        hotspot: [4, 2],
        scale: 0.7,
      };
  }
};

export const useCustomCursor = (mode: ToolType) => {
  const [cursorStyle, setCursorStyle] = useState<string>("auto");

  useEffect(() => {
    const loadCursor = async () => {
      const config = getCursorConfig(mode);
      const dataUrl = await loadSvgAsCursor(config.path, config.scale);

      if (dataUrl) {
        setCursorStyle(
          `url('${dataUrl}') ${config.hotspot[0]} ${config.hotspot[1]}, auto`
        );
      } else {
        setCursorStyle("auto");
      }
    };

    loadCursor();
  }, [mode]);

  return cursorStyle;
};
