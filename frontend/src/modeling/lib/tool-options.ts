export type RectFillShape = "Full" | "Sphere" | "Cylinder" | "Triangle4";

export type ToolOptions = {
  Rect: {
    fillShape: RectFillShape;
  };
  MoveSelection: {
    axisLock: "Free" | "X" | "Y" | "Z";
  };
  BlockPicker: {
    pickTarget: "BlockType" | "Color";
  };
  MagicSelect: {
    connectivity: "Faces" | "Volume";
  };
};

export const defaultToolOptions: ToolOptions = {
  Rect: { fillShape: "Full" },
  MoveSelection: { axisLock: "Free" },
  BlockPicker: { pickTarget: "BlockType" },
  MagicSelect: { connectivity: "Faces" },
};
