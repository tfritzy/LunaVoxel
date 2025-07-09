import { useState } from "react";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AtlasTextureDropdownProps {
  selectedTexture: number;
  onSelect: (textureIndex: number) => void;
  size?: "sm" | "md" | "lg";
}

export const AtlasTextureDropdown = ({
  selectedTexture,
  onSelect,
  size = "sm",
}: AtlasTextureDropdownProps) => {
  const { atlas, atlasSlots } = useCurrentProject();
  const [isOpen, setIsOpen] = useState(false);

  const sizeClasses = {
    sm: "w-12 h-12",
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
      className="h-12 w-12 p-1"
    >
      <img
        src={slot.blobUrl}
        alt={`Texture ${index}`}
        className="w-full h-full rounded-sm"
      />
    </Button>
  ));

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger>
        <Button variant="outline" className={cn("p-1", sizeClasses[size])}>
          <img
            src={atlasSlots[selectedTexture]?.blobUrl || ""}
            alt={`Selected Texture ${selectedTexture}`}
            className="w-full h-full rounded-sm"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="grid grid-cols-6 gap-x-1 gap-y-1">
        {options}
      </PopoverContent>
    </Popover>
  );
};
