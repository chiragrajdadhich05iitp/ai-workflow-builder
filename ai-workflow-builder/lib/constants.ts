// lib/constants.ts

export const DEBOUNCE_SAVE_MS = 750;

export const PRE_PLACED_NODE_IDS = ["n_request_inputs", "n_response"] as const;

export const MAX_FIELDS_PER_REQUEST_INPUT = 20;

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-pro";

export const AVAILABLE_GEMINI_MODELS = [
  { value: "gemini-2.5-pro",      label: "Gemini 3.1 Pro" },
  { value: "gemini-flash-latest", label: "Gemini Flash (Latest)" },
  // { value: "gemini-2.0-flash",    label: "Gemini 2.0 Flash" },
  // { value: "gemini-1.5-pro",      label: "Gemini 1.5 Pro" },
  // { value: "gemini-1.5-flash",    label: "Gemini 1.5 Flash" },
] as const;

export const HISTORY_PAGE_SIZE = 20;

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const TRIGGER_RUN_TAG_PREFIX = "run";
export const TRIGGER_NODE_TAG_PREFIX = "node";

export const CROP_DELAY_SECONDS = 30;

export const UNTITLED_WORKFLOW_BASE = "Untitled Workflow";
