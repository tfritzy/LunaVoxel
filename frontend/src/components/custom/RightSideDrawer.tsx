import { AtlasSection } from "./atlas/AtlasSection";
import { LayersSection } from "./layers/LayersSection";

export const RightSideDrawer = () => {
  return (
    <div className="absolute right-0 top-0 h-full bg-background border-l border-border overflow-y-auto">
      <div className="p-4">
        <AtlasSection />
      </div>

      <div className="border-b border-border" />

      <div className="p-4">
        <LayersSection />
      </div>
    </div>
  );
};
