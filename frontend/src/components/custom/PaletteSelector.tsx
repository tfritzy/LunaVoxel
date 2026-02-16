import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { colorPalettes, type ColorPalette } from "./colorPalettes";

const PalettePreview = ({ palette }: { palette: ColorPalette }) => {
  const previewColors = palette.colors.slice(0, 10);
  return (
    <div className="flex gap-0.5">
      {previewColors.map((color, i) => (
        <div
          key={i}
          className="w-3.5 h-3.5 rounded-sm"
          style={{
            backgroundColor: `#${color.toString(16).padStart(6, "0")}`,
          }}
        />
      ))}
      {palette.colors.length > 10 && (
        <span className="text-[10px] text-muted-foreground self-center ml-0.5">
          +{palette.colors.length - 10}
        </span>
      )}
    </div>
  );
};

export const PaletteSelector = ({
  onSelect,
}: {
  onSelect: (colors: number[]) => void;
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          <span>Palette</span>
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {colorPalettes.map((palette) => (
          <DropdownMenuItem
            key={palette.name}
            onClick={() => onSelect(palette.colors)}
            className="flex flex-col items-start gap-1.5 py-2"
          >
            <span className="text-sm font-medium">{palette.name}</span>
            <PalettePreview palette={palette} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
