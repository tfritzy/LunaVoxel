import { BlockModificationMode } from "@/module_bindings";

export type FrontendTool = "build" | "erase" | "paint" | "block-picker";

export const frontendToolToBackend = (
  tool: FrontendTool
): BlockModificationMode | null => {
  switch (tool) {
    case "build":
      return { tag: "Build" };
    case "erase":
      return { tag: "Erase" };
    case "paint":
      return { tag: "Paint" };
    case "block-picker":
      return null;
  }
};

export const backendToolToFrontend = (
  tool: BlockModificationMode
): FrontendTool => {
  switch (tool.tag) {
    case "Build":
      return "build";
    case "Erase":
      return "erase";
    case "Paint":
      return "paint";
  }
};
