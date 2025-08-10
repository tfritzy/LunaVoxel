import { AtlasSection } from "./atlas/AtlasSection";
import { LayersSection } from "./layers/LayersSection";

interface RightSideDrawerProps {
  onSelectLayer?: (layerIndex: number) => void;
}

export const RightSideDrawer = ({ onSelectLayer }: RightSideDrawerProps) => {
  return (
    <div className="absolute right-0 top-0 h-full bg-background border-l border-border overflow-y-auto">
      <div className="p-4">
        <AtlasSection />
      </div>

      <div className="border-b border-border" />

      <div className="">
        <LayersSection onSelectLayer={onSelectLayer} />
      </div>
    </div>
  );
};
