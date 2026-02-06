import { LayersSection } from "./layers/LayersSection";

interface RightSideDrawerProps {
  onSelectLayer?: (layerIndex: number) => void;
}

export const RightSideDrawer = ({
  onSelectLayer,
}: RightSideDrawerProps) => {
  return (
    <div className="h-full bg-background border-l border-border overflow-y-auto w-56">
      <div className="">
        <LayersSection onSelectLayer={onSelectLayer} />
      </div>
    </div>
  );
};
