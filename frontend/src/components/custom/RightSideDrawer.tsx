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
      <div className="">
        <LayersSection onSelectLayer={onSelectLayer} projectId={projectId} />
      </div>
    </div>
  );
};
