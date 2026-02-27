export type ToolType =
  | "MoveSelection"
  | "ObjectTransform"
  | "Rect"
  | "Shape"
  | "Brush"
  | "SprayPaint"
  | "BlockPicker"
  | "Select"
  | "Fill"

export type FillShape = "Rect" | "Sphere" | "Cylinder" | "Triangle" | "Diamond" | "Cone" | "Pyramid" | "Hexagon";

export type ShapeDirection = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

export type BrushShape = "Sphere" | "Cube" | "Cylinder" | "Diamond";

export type SelectShape = "Magic" | "Rectangle" | "Circle" | "Lasso";
