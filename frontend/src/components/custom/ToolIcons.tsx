import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: "1.5",
};

// Attach mode: isometric voxel cube with a + indicating block placement
export const AttachModeIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" {...props}>
    {/* Isometric cube – small, offset left to make room for + badge */}
    <path d="M9 3L16 7L9 11L2 7Z" />
    <path d="M2 7L2 15L9 19L9 11" />
    <path d="M16 7L16 15L9 19" />
    {/* + badge top-right */}
    <path d="M18 1V7M15 4H21" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// Paint mode: detailed paintbrush with bristle tip
export const PaintModeIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" {...props}>
    {/* Handle */}
    <path d="M21 3L12 12" strokeWidth="2.5" />
    {/* Ferrule (metal band) */}
    <path d="M12 12L10 14" strokeWidth="4" strokeLinecap="butt" />
    {/* Bristle body */}
    <path d="M10 14C7.5 14.5 5.5 16.5 5 19C6 21.5 8.5 22 10.5 20.5C12 19 11.5 15 10 14Z" fill="currentColor" stroke="none" />
    {/* Bristle tip */}
    <path d="M5 19C4.5 20.5 5 22 6 22.5" />
    {/* Paint stroke on surface */}
    <path d="M3 21.5Q7 23 11 21" strokeWidth="1" strokeOpacity="0.55" />
  </svg>
);

// Erase mode: rectangular eraser block with erased line
export const EraseModeIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" {...props}>
    {/* Eraser body */}
    <path d="M4 15L8 7H20L16 15H4Z" />
    {/* Band across eraser */}
    <path d="M9 15L13 7" strokeWidth="2.5" />
    {/* Erased baseline */}
    <path d="M2 18H22" />
    {/* Debris dots */}
    <circle cx="5" cy="20" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="9" cy="21" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="14" cy="20" r="0.8" fill="currentColor" stroke="none" />
  </svg>
);

// Move selection: 4 directional arrows with a dashed selection box
export const MoveSelectionIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" {...props}>
    {/* Dashed selection rect */}
    <rect x="7" y="7" width="10" height="10" strokeDasharray="2.5 1.5" />
    {/* Arrow up */}
    <path d="M12 1L9.5 4.5H14.5L12 1Z" fill="currentColor" stroke="none" />
    <line x1="12" y1="4.5" x2="12" y2="7" />
    {/* Arrow down */}
    <path d="M12 23L9.5 19.5H14.5L12 23Z" fill="currentColor" stroke="none" />
    <line x1="12" y1="19.5" x2="12" y2="17" />
    {/* Arrow left */}
    <path d="M1 12L4.5 9.5V14.5L1 12Z" fill="currentColor" stroke="none" />
    <line x1="4.5" y1="12" x2="7" y2="12" />
    {/* Arrow right */}
    <path d="M23 12L19.5 9.5V14.5L23 12Z" fill="currentColor" stroke="none" />
    <line x1="19.5" y1="12" x2="17" y2="12" />
  </svg>
);

// Rect tool: isometric 3D rectangular prism (wide, landscape)
export const RectToolIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" {...props}>
    {/* Top face – wide */}
    <path d="M3 8L12 4L21 8L12 12L3 8Z" />
    {/* Left face */}
    <path d="M3 8L3 16L12 20L12 12" fill="currentColor" fillOpacity="0.18" />
    {/* Right face */}
    <path d="M21 8L21 16L12 20L12 12" fill="currentColor" fillOpacity="0.32" />
    {/* Bottom edge */}
    <path d="M3 16L12 20L21 16" />
  </svg>
);

// Shape tool: cluster of 3 small isometric voxel cubes
export const ShapeToolIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" strokeWidth="1.25" {...props}>
    {/* Bottom-left cube */}
    <path d="M2 14L6 12L10 14L6 16Z" />
    <path d="M2 14L2 18L6 20L6 16" />
    <path d="M10 14L10 18L6 20" />
    {/* Top-center cube */}
    <path d="M7 7L11 5L15 7L11 9Z" />
    <path d="M7 7L7 11L11 13L11 9" />
    <path d="M15 7L15 11L11 13" />
    {/* Right cube */}
    <path d="M14 13L18 11L22 13L18 15Z" />
    <path d="M14 13L14 17L18 19L18 15" />
    <path d="M22 13L22 17L18 19" />
  </svg>
);

// Brush tool: paintbrush with visible individual bristle lines
export const BrushToolIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" {...props}>
    {/* Handle */}
    <path d="M21 3L13 11" strokeWidth="2.5" />
    {/* Ferrule */}
    <path d="M13 11L11 13" strokeWidth="4" strokeLinecap="butt" />
    {/* Three bristle lines fanning out */}
    <path d="M11 13C9 14 7.5 16.5 6.5 19.5" strokeWidth="1.5" />
    <path d="M11 13C9.5 15 8.5 18 8 20.5" strokeWidth="1.5" />
    <path d="M11 13C10 15.5 10 18.5 9.5 21" strokeWidth="1.5" />
    {/* Bristle tip arc */}
    <path d="M6.5 19.5C6 21.5 7.5 22.5 9.5 21" />
  </svg>
);

// Spray paint tool: spray can body with mist particle dots
export const SprayPaintToolIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" {...props}>
    {/* Can body */}
    <rect x="2" y="8" width="10" height="13" rx="2" />
    {/* Can cap */}
    <rect x="4" y="5" width="6" height="3" rx="1" />
    {/* Nozzle arm */}
    <path d="M10 6H13" />
    <path d="M13 6V9" />
    {/* Spray particle cloud */}
    <circle cx="16" cy="10" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="8.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="20.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="17" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="19.5" cy="13" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="21.5" cy="11.5" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="13.5" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="21.5" cy="13.5" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="18" cy="15" r="0.7" fill="currentColor" stroke="none" />
  </svg>
);

// Fill tool: paint bucket with dripping paint
export const FillToolIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" {...props}>
    {/* Bucket body */}
    <path d="M5 8L7 19H15L17 8H5Z" />
    {/* Bucket rim */}
    <path d="M4 8H18" />
    {/* Handle arch */}
    <path d="M8 8V5C8 4 9 3 10 3H12C13 3 14 4 14 5V8" />
    {/* Paint stream from bucket */}
    <path d="M17 10L20 13" strokeWidth="2.5" />
    {/* Drip column */}
    <path d="M20 13C20.5 15 20.5 17 20 18.5" strokeWidth="2" />
    {/* Paint drop at tip */}
    <circle cx="20" cy="20" r="1.75" fill="currentColor" strokeWidth="1" />
  </svg>
);

// Block picker: eyedropper with a colored voxel face at the tip
export const BlockPickerIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" {...props}>
    {/* Dropper body outline */}
    <path d="M14 4L20 10L10 20L4 14Z" />
    {/* Highlight stripe on barrel */}
    <path d="M15.5 5.5L19 9" strokeWidth="1" strokeOpacity="0.4" />
    {/* Rubber bulb at top */}
    <path
      d="M13 4C13 2 15 1 16.5 1.5C18 2 18.5 4 17 5L15 5Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
    />
    {/* Tip connector to voxel */}
    <path d="M4 14L2 20" />
    {/* Small voxel face being picked (diamond = top face of isometric cube) */}
    <path d="M2 20L4.5 18.5L7 20L4.5 21.5Z" fill="currentColor" stroke="none" />
  </svg>
);

// Select tool: dashed rectangle with filled corner handles
export const SelectBoxIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" {...props}>
    {/* Dashed border */}
    <rect x="3" y="3" width="18" height="18" strokeDasharray="3 2.5" />
    {/* Corner handles (solid squares) */}
    <rect x="1" y="1" width="4" height="4" fill="currentColor" stroke="none" />
    <rect x="19" y="1" width="4" height="4" fill="currentColor" stroke="none" />
    <rect x="1" y="19" width="4" height="4" fill="currentColor" stroke="none" />
    <rect x="19" y="19" width="4" height="4" fill="currentColor" stroke="none" />
  </svg>
);

// Magic select: wand with a star burst at the tip
export const MagicWandIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" {...props}>
    {/* Wand handle */}
    <path d="M3 21L14 10" strokeWidth="2" />
    {/* Star at wand tip */}
    <path
      d="M17 3L18.5 7L22 8.5L18.5 10L17 14L15.5 10L12 8.5L15.5 7Z"
      fill="currentColor"
      stroke="none"
    />
    {/* Small sparkles */}
    <path d="M5 7L5.8 9L7 7L5.8 5Z" fill="currentColor" stroke="none" />
    <path d="M20 16L20.6 17.8L22 16L20.6 14.2Z" fill="currentColor" stroke="none" />
  </svg>
);

// Rectangle select: dashed box with a move cursor hint
export const RectSelectIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" {...props}>
    {/* Dashed selection rectangle */}
    <rect x="2" y="3" width="16" height="14" strokeDasharray="3 2" />
    {/* Arrow cursor emerging from bottom-right corner */}
    <path d="M16 14L22 21" strokeWidth="2" />
    <path d="M16 14L21 14L16 19Z" fill="currentColor" stroke="none" />
  </svg>
);

// Circle select: dashed oval with crosshair center
export const CircleSelectIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" {...props}>
    <ellipse cx="12" cy="12" rx="9.5" ry="9.5" strokeDasharray="3 2.5" />
    {/* Crosshair */}
    <line x1="12" y1="8.5" x2="12" y2="10" />
    <line x1="12" y1="14" x2="12" y2="15.5" />
    <line x1="8.5" y1="12" x2="10" y2="12" />
    <line x1="14" y1="12" x2="15.5" y2="12" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

// Lasso select: freehand organic loop with rope tail
export const LassoSelectIcon = (props: IconProps) => (
  <svg {...base} stroke="currentColor" {...props}>
    {/* Lasso loop */}
    <path d="M5 15C3 12 3 8 5.5 6C8 4 13 4 16 7C18.5 9.5 18 13 15.5 14.5C13.5 15.5 11 15 10 13C9 11 10 9 12 9.5C13.5 10 13 12 12 12.5" />
    {/* Rope tail hanging down */}
    <path d="M12 12.5L10 17L8 21" strokeDasharray="2 1.5" />
    <path d="M8 21L6.5 19.5" />
  </svg>
);
