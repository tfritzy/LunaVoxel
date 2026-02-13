import { ObjectsSection } from "./objects/ObjectsSection";

interface RightSideDrawerProps {
  onSelectObject?: (objectIndex: number) => void;
  projectId: string;
}

export const RightSideDrawer = ({
  onSelectObject,
  projectId,
}: RightSideDrawerProps) => {
  return (
    <div className="h-full bg-background border-l border-border overflow-y-auto w-56">
      <div className="">
        <ObjectsSection onSelectObject={onSelectObject} projectId={projectId} />
      </div>
    </div>
  );
};
