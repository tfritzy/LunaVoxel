import { useState } from "react";
import { useAtlasContext } from "@/contexts/CurrentProjectContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link2Icon } from "lucide-react";

interface AtlasTextureDropdownProps {
  selectedTexture: number;
  onSelect: (textureIndex: number) => void;
  size?: "sm" | "md" | "lg";
  isLinked?: boolean;
}

export const AtlasTextureDropdown = ({
  selectedTexture,
  onSelect,
  size = "sm",
  isLinked = false,
}: AtlasTextureDropdownProps) => {
  const { atlasSlots } = useAtlasContext();
  const [isOpen, setIsOpen] = useState(false);

  const sizeClasses = {
    sm: "w-14 h-14",
    md: "w-18 h-18",
    lg: "w-22 h-22",
  } as const;

  const options = atlasSlots.map((slot, index) => (
    <Button
      variant={selectedTexture === index ? "outline" : "ghost"}
      key={index}
      onClick={() => {
        onSelect(index);
        setIsOpen(false);
      }}
      className="h-14 w-14 p-1"
    >
      <img
        src={slot.blobUrl || ""}
        draggable={false}
        alt={`Texture ${index}`}
        className="w-full h-full rounded-xs"
        style={{ imageRendering: "pixelated" }}
      />
    </Button>
  ));

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("p-0 relative rounded-xs", sizeClasses[size])}
        >
          <img
            src={atlasSlots[selectedTexture]?.blobUrl || ""}
            alt={`Selected Texture ${selectedTexture}`}
            className="w-full h-full rounded-xs"
            style={{ imageRendering: "pixelated" }}
          />

          {isLinked && (
            <div className="absolute top-1/2 -translate-x-1/2 left-1/2 -translate-y-1/2 flex items-center justify-center">
              <Link2Icon className="w-3 h-3 text-white/75" />
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="grid grid-cols-6 overflow-y-auto">
        {options}
      </PopoverContent>
    </Popover>
  );
};
