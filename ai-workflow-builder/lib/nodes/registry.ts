// lib/nodes/registry.ts

import type { HandleKind, NodeType, NodeData } from "./types";
import {
  defaultRequestInputsData,
  defaultCropImageData,
  defaultGeminiData,
  defaultResponseData,
  defaultStickyNoteData,
} from "./defaults";

export interface HandleSpec {
  id: string;
  kind: HandleKind;
  direction: "in" | "out";
  label: string;
  multi?: boolean;     // for vision__in
  required?: boolean;  // visually marked with asterisk
}

export interface NodeTypeSpec {
  type: NodeType;
  label: string;
  category: "Pre-placed" | "Image" | "LLM" | "Video" | "Audio" | "Others";
  icon: string;          // Lucide icon name
  deletable: boolean;
  description: string;
  defaultData: () => NodeData;
  /** Static handles; "dynamic" means derive from data.fields (request_inputs) */
  handles: HandleSpec[] | "dynamic";
  /** For request_inputs: derive handles from data.fields */
  deriveHandles?: (data: any) => HandleSpec[];
  /** Canvas-only node — not persisted to DB, stripped before hardSave */
  canvasOnly?: boolean;
}

export const NODE_REGISTRY: Partial<Record<NodeType, NodeTypeSpec>> = {
  request_inputs: {
    type:        "request_inputs",
    label:       "Request Inputs",
    category:    "Pre-placed",
    icon:        "FormInput",
    deletable:   false,
    description: "The entry point of the workflow. Add text and image fields.",
    defaultData: defaultRequestInputsData,
    handles:     "dynamic",
    deriveHandles(data: any): HandleSpec[] {
      const fields: Array<{ id: string; kind: string }> = data?.fields ?? [];
      return fields.map((f) => ({
        id:        `${f.id}__out`,
        kind:      f.kind === "image_field" ? "image" : "text",
        direction: "out",
        label:     f.kind === "image_field" ? "Image" : "Text",
      }));
    },
  },

  crop_image: {
    type:        "crop_image",
    label:       "Crop Image",
    category:    "Image",
    icon:        "Crop",
    deletable:   true,
    description: "Crop an image by percentage bounds using FFmpeg.",
    defaultData: defaultCropImageData,
    handles: [
      { id: "image__in",   kind: "image",  direction: "in",  label: "Input Image",   required: true },
      { id: "x__in",       kind: "number", direction: "in",  label: "X Position (%)" },
      { id: "y__in",       kind: "number", direction: "in",  label: "Y Position (%)" },
      { id: "width__in",   kind: "number", direction: "in",  label: "Width (%)" },
      { id: "height__in",  kind: "number", direction: "in",  label: "Height (%)" },
      { id: "output_image__out", kind: "image", direction: "out", label: "Output Image" },
    ],
  },

  gemini: {
    type:        "gemini",
    label:       "Gemini 3.1 Pro",
    category:    "LLM",
    icon:        "Sparkles",
    deletable:   true,
    description: "Google Gemini multimodal LLM — text, vision, audio, file.",
    defaultData: defaultGeminiData,
    handles: [
      { id: "prompt__in",       kind: "text",  direction: "in",  label: "Prompt",         required: true },
      { id: "system_prompt__in",kind: "text",  direction: "in",  label: "System Prompt" },
      { id: "vision__in",       kind: "image", direction: "in",  label: "Image (Vision)", multi: true },
      { id: "video__in",        kind: "video", direction: "in",  label: "Video" },
      { id: "audio__in",        kind: "audio", direction: "in",  label: "Audio" },
      { id: "file__in",         kind: "file",  direction: "in",  label: "File" },
      { id: "response__out",    kind: "text",  direction: "out", label: "Response" },
    ],
  },

  response: {
    type:        "response",
    label:       "Response",
    category:    "Pre-placed",
    icon:        "ArrowRightFromLine",
    deletable:   false,
    description: "The final output sink — captures and displays the workflow result.",
    defaultData: defaultResponseData,
    handles: [
      { id: "result__in", kind: "any", direction: "in", label: "Result" },
    ],
  },

  sticky_note: {
    type:        "sticky_note",
    label:       "Sticky Note",
    category:    "Others",
    icon:        "StickyNote",
    deletable:   true,
    description: "A canvas-only note. Not persisted to the database.",
    defaultData: defaultStickyNoteData,
    handles:     [],
    canvasOnly:  true,
  },
};

/** Get the list of handles for a node. Handles dynamic (request_inputs) via deriveHandles. */
export function getNodeHandles(spec: NodeTypeSpec, data: any): HandleSpec[] {
  if (spec.handles === "dynamic") {
    return spec.deriveHandles?.(data) ?? [];
  }
  return spec.handles;
}

/** Look up the kind of a handle by nodeType + handleId. */
export function getHandleKind(
  nodeType: NodeType,
  handleId: string
): HandleKind | null {
  const spec = NODE_REGISTRY[nodeType];
  if (!spec) return null;
  if (spec.handles === "dynamic") return null; // caller must pass derived handles
  const h = spec.handles.find((h) => h.id === handleId);
  return h?.kind ?? null;
}
