// lib/nodes/defaults.ts
// Factory functions that return the initial data for each node type

import type {
  RequestInputsData,
  CropImageData,
  GeminiData,
  ResponseData,
  StickyNoteData,
} from "./types";
import { DEFAULT_GEMINI_MODEL } from "@/lib/constants";

export function defaultRequestInputsData(): RequestInputsData {
  return { fields: [] };
}

export function defaultCropImageData(): CropImageData {
  return {
    input: { image: { value: null, connected: false } },
    params: {
      x:      { value: 0,   connected: false },
      y:      { value: 0,   connected: false },
      width:  { value: 100, connected: false },
      height: { value: 100, connected: false },
    },
  };
}

export function defaultGeminiData(): GeminiData {
  return {
    model:        DEFAULT_GEMINI_MODEL,
    prompt:       { value: "",   connected: false },
    systemPrompt: { value: "",   connected: false },
    vision:       { values: [], connectedFrom: [] },
    video:        { value: null, connected: false },
    audio:        { value: null, connected: false },
    file:         { value: null, connected: false },
    settings: {
      temperature:      0.7,
      topP:             0.95,
      topK:             40,
      maxOutputTokens:  1024,
    },
    settingsCollapsed: true,
  };
}

export function defaultResponseData(): ResponseData {
  return { label: "gemini_3_1_pro", result: null };
}

export function defaultStickyNoteData(): StickyNoteData {
  return { text: "", color: "#FEFCE8" };
}
