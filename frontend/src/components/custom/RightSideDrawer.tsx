import { AtlasSection } from "./atlas/AtlasSection";
import { LayersSection } from "./layers/LayersSection";

interface RightSideDrawerProps {
  onSelectLayer?: (layerIndex: number) => void;
  projectId: string;
}

export const RightSideDrawer = ({
  onSelectLayer,
  projectId,
}: RightSideDrawerProps) => {
  return (
    <div className="h-full bg-background border-l border-border overflow-y-auto w-56">
      <div className="p-4">
        <AtlasSection />
      </div>
      <div className="border-b border-border" />
      <div className="">
        <LayersSection onSelectLayer={onSelectLayer} projectId={projectId} />
      </div>
    </div>
  );
};