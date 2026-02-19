export type ToolType =
  | "MoveSelection"
  | "Rect"
  | "Brush"
  | "BlockPicker"
  | "MagicSelect" 

export type FillShape = "Rect" | "Sphere" | "Cylinder" | "Triangle" | "Diamond" | "Cone" | "Pyramid" | "Hexagon" | "Cross";

export type ShapeDirection = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

export type BrushShape = "Sphere" | "Cube" | "Cylinder" | "Diamond" | "Cross";
