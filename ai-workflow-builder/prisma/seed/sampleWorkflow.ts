// prisma/seed/sampleWorkflow.ts
// The required "Trial Task Workflow" — exact topology from HLD §11

import type { CanvasNode, CanvasEdge } from "@/lib/nodes/types";

// CDN-hosted placeholder product image (runnable without the user uploading anything)
const PLACEHOLDER_IMAGE_URL =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop";

export const SAMPLE_WORKFLOW_NAME = "Trial Task Workflow";

export const SAMPLE_NODES: CanvasNode[] = [
  // Request Inputs (pre-placed)
  {
    id:       "n_request_inputs",
    type:     "request_inputs",
    position: { x: 80, y: 420 },
    data: {
      fields: [
        {
          id:    "f_text_1",
          kind:  "text_field",
          name:  "text_field",
          value: "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.",
        },
        {
          id:    "f_image_1",
          kind:  "image_field",
          name:  "image_field",
          value: PLACEHOLDER_IMAGE_URL,
        },
      ],
    },
  },

  // Gemini #1 — product description
  {
    id:       "n_gemini_1",
    type:     "gemini",
    position: { x: 520, y: 200 },
    data: {
      model:        "gemini-2.0-flash",
      prompt:       { value: "",   connected: true  },
      systemPrompt: { value: "You are a marketing copywriter. Write a one-paragraph product description.", connected: false },
      vision:       { values: [], connectedFrom: [] },
      video:        { value: null, connected: false },
      audio:        { value: null, connected: false },
      file:         { value: null, connected: false },
      settings: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 1024 },
      settingsCollapsed: true,
    },
  },

  // Crop #1 — tight product crop
  {
    id:       "n_crop_1",
    type:     "crop_image",
    position: { x: 520, y: 520 },
    data: {
      input:  { image: { value: null, connected: true } },
      params: {
        x:      { value: 20, connected: false },
        y:      { value: 20, connected: false },
        width:  { value: 60, connected: false },
        height: { value: 60, connected: false },
      },
    },
  },

  // Crop #2 — wide banner crop
  {
    id:       "n_crop_2",
    type:     "crop_image",
    position: { x: 520, y: 780 },
    data: {
      input:  { image: { value: null, connected: true } },
      params: {
        x:      { value: 0,   connected: false },
        y:      { value: 0,   connected: false },
        width:  { value: 100, connected: false },
        height: { value: 50,  connected: false },
      },
    },
  },

  // Gemini #2 — tweet hook
  {
    id:       "n_gemini_2",
    type:     "gemini",
    position: { x: 960, y: 200 },
    data: {
      model:        "gemini-2.0-flash",
      prompt:       { value: "",   connected: true  },
      systemPrompt: { value: "Condense the following product description into a tweet-length hook (under 240 characters).", connected: false },
      vision:       { values: [], connectedFrom: [] },
      video:        { value: null, connected: false },
      audio:        { value: null, connected: false },
      file:         { value: null, connected: false },
      settings: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 256 },
      settingsCollapsed: true,
    },
  },

  // Final Gemini — social media post
  {
    id:       "n_gemini_final",
    type:     "gemini",
    position: { x: 1400, y: 480 },
    data: {
      model:        "gemini-2.0-flash",
      prompt:       { value: "",   connected: true  },
      systemPrompt: { value: "You are a social media manager. Combine the tweet hook and the two product crops into a final marketing post.", connected: false },
      vision:       {
        values:        [],
        connectedFrom: ["n_crop_1:output_image__out", "n_crop_2:output_image__out"],
      },
      video:        { value: null, connected: false },
      audio:        { value: null, connected: false },
      file:         { value: null, connected: false },
      settings: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 1024 },
      settingsCollapsed: true,
    },
  },

  // Response (pre-placed)
  {
    id:       "n_response",
    type:     "response",
    position: { x: 1900, y: 500 },
    data: { label: "gemini_3_1_pro", result: null },
  },
];

export const SAMPLE_EDGES: CanvasEdge[] = [
  // text_field → Gemini #1 Prompt
  { id: "e_n_request_inputs__f_text_1__out__n_gemini_1__prompt__in",     source: "n_request_inputs", sourceHandle: "f_text_1__out",       target: "n_gemini_1",    targetHandle: "prompt__in",     type: "animated" },

  // image_field → Crop #1 Input Image
  { id: "e_n_request_inputs__f_image_1__out__n_crop_1__image__in",       source: "n_request_inputs", sourceHandle: "f_image_1__out",      target: "n_crop_1",      targetHandle: "image__in",      type: "animated" },

  // image_field → Crop #2 Input Image
  { id: "e_n_request_inputs__f_image_1__out__n_crop_2__image__in",       source: "n_request_inputs", sourceHandle: "f_image_1__out",      target: "n_crop_2",      targetHandle: "image__in",      type: "animated" },

  // Gemini #1 Response → Gemini #2 Prompt
  { id: "e_n_gemini_1__response__out__n_gemini_2__prompt__in",           source: "n_gemini_1",       sourceHandle: "response__out",       target: "n_gemini_2",    targetHandle: "prompt__in",     type: "animated" },

  // Gemini #2 Response → Final Gemini Prompt
  { id: "e_n_gemini_2__response__out__n_gemini_final__prompt__in",       source: "n_gemini_2",       sourceHandle: "response__out",       target: "n_gemini_final", targetHandle: "prompt__in",    type: "animated" },

  // Crop #1 Output → Final Gemini Vision
  { id: "e_n_crop_1__output_image__out__n_gemini_final__vision__in",     source: "n_crop_1",         sourceHandle: "output_image__out",   target: "n_gemini_final", targetHandle: "vision__in",    type: "animated" },

  // Crop #2 Output → Final Gemini Vision
  { id: "e_n_crop_2__output_image__out__n_gemini_final__vision__in",     source: "n_crop_2",         sourceHandle: "output_image__out",   target: "n_gemini_final", targetHandle: "vision__in",    type: "animated" },

  // Final Gemini Response → Response
  { id: "e_n_gemini_final__response__out__n_response__result__in",       source: "n_gemini_final",   sourceHandle: "response__out",       target: "n_response",    targetHandle: "result__in",     type: "animated" },
];

/**
 * Seeds the sample workflow for a new user. Called from ensureUser on first dashboard load.
 */
export async function seedSampleWorkflow(prisma: any, userId: string) {
  await prisma.workflow.create({
    data: {
      userId,
      name:  SAMPLE_WORKFLOW_NAME,
      nodes: SAMPLE_NODES as any,
      edges: SAMPLE_EDGES as any,
    },
  });
}
