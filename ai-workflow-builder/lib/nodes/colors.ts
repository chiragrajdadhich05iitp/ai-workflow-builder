// lib/nodes/colors.ts
// Handle-type → hex color mapping (verified against Galaxy.ai reference)

import type { HandleKind } from "./types";

export const HANDLE_COLORS: Record<HandleKind, string> = {
  text:   "#F97316", // orange
  image:  "#3B82F6", // blue
  video:  "#22C55E", // green
  audio:  "#06B6D4", // cyan
  file:   "#A855F7", // purple
  number: "#EC4899", // pink
  any:    "#6B7280", // gray
};

export function getHandleColor(kind: HandleKind): string {
  return HANDLE_COLORS[kind] ?? "#6B7280";
}
