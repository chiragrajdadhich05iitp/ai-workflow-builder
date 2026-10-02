// lib/nodes/icons.ts
// Lucide icon names for node types (used in picker + node headers)

import type { NodeType } from "./types";

export const NODE_ICONS: Record<NodeType, string> = {
  request_inputs: "FormInput",
  crop_image:     "Crop",
  gemini:         "Sparkles",
  response:       "ArrowRightFromLine",
  sticky_note:    "StickyNote",
};
