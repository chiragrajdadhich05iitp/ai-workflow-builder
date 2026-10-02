// lib/nodes/schema.ts
// All Zod schemas for API validation and node data validation

import { z } from "zod";

export const handleKindSchema = z.enum([
  "text", "image", "video", "audio", "file", "number", "any",
]);

// Helper: wraps a type in { value: T | null, connected: boolean }
const connectable = <T extends z.ZodTypeAny>(t: T) =>
  z.object({ value: t.nullable(), connected: z.boolean() });

// Helper: wraps a type in { values: T[], connectedFrom: string[] }
const multiConnectable = <T extends z.ZodTypeAny>(t: T) =>
  z.object({ values: z.array(t), connectedFrom: z.array(z.string()) });

// ── Node data schemas ─────────────────────────────────────────────────────────

export const requestInputsDataSchema = z.object({
  fields: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({
          id:    z.string(),
          kind:  z.literal("text_field"),
          name:  z.string().min(1),
          value: z.string(),
        }),
        z.object({
          id:    z.string(),
          kind:  z.literal("image_field"),
          name:  z.string().min(1),
          value: z.string().url().nullable(),
        }),
      ])
    )
    .max(20),
});

export const cropImageDataSchema = z
  .object({
    input: z.object({ image: connectable(z.string().url()) }),
    params: z.object({
      x:      connectable(z.number().min(0).max(100)),
      y:      connectable(z.number().min(0).max(100)),
      width:  connectable(z.number().min(0).max(100)),
      height: connectable(z.number().min(0).max(100)),
    }),
  })
  .refine(
    (d) =>
      (d.params.x.value ?? 0) + (d.params.width.value ?? 0)  <= 100 &&
      (d.params.y.value ?? 0) + (d.params.height.value ?? 0) <= 100,
    { message: "x+width and y+height must each be ≤ 100" }
  );

export const geminiDataSchema = z.object({
  model:        z.string().default("gemini-2.5-pro"),
  prompt:       connectable(z.string()),
  systemPrompt: connectable(z.string()),
  vision:       multiConnectable(z.string().url()),
  video:        connectable(z.string().url()),
  audio:        connectable(z.string().url()),
  file:         connectable(z.string().url()),
  settings: z.object({
    temperature:     z.number().min(0).max(2).default(0.7),
    topP:            z.number().min(0).max(1).default(0.95),
    topK:            z.number().int().min(1).max(100).default(40),
    maxOutputTokens: z.number().int().min(1).max(8192).default(1024),
  }),
  settingsCollapsed: z.boolean().default(true),
});

export const responseDataSchema = z.object({
  label:  z.string(),
  result: z.unknown().nullable(),
});

// ── Canvas node / edge schemas ────────────────────────────────────────────────

const xySchema = z.object({ x: z.number(), y: z.number() });

export const stickyNoteDataSchema = z.object({
  text:  z.string(),
  color: z.string(),
});

export const canvasNodeSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("request_inputs"), position: xySchema, data: requestInputsDataSchema }),
  z.object({ id: z.string(), type: z.literal("crop_image"),     position: xySchema, data: cropImageDataSchema }),
  z.object({ id: z.string(), type: z.literal("gemini"),         position: xySchema, data: geminiDataSchema }),
  z.object({ id: z.string(), type: z.literal("response"),       position: xySchema, data: responseDataSchema }),
  z.object({ id: z.string(), type: z.literal("sticky_note"),    position: xySchema, data: stickyNoteDataSchema }),
]);

export const canvasEdgeSchema = z.object({
  id:           z.string(),
  source:       z.string(),
  sourceHandle: z.string(),
  target:       z.string(),
  targetHandle: z.string(),
  type:         z.literal("animated").optional(),
});

export const graphSchema = z.object({
  nodes: z.array(canvasNodeSchema).max(100),
  edges: z.array(canvasEdgeSchema).max(500),
});

// ── Run schemas ───────────────────────────────────────────────────────────────

export const runStartSchema = z
  .object({
    scope:           z.enum(["FULL", "PARTIAL", "SINGLE"]),
    selectedNodeIds: z.array(z.string()).optional(),
    manualValues:    z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  })
  .refine(
    (v) => {
      const n = v.selectedNodeIds?.length ?? 0;
      if (v.scope === "FULL")   return n === 0;
      if (v.scope === "SINGLE") return n === 1;
      return n >= 1; // PARTIAL
    },
    { message: "selectedNodeIds inconsistent with scope: FULL=0, SINGLE=1, PARTIAL=≥1" }
  );

// ── PATCH schema ──────────────────────────────────────────────────────────────

export const workflowPatchSchema = z.union([
  z.object({ name: z.string().min(1).max(120) }),
  z.object({ graph: graphSchema, version: z.number().int().nonnegative() }),
]);

// ── Upload signature schema ───────────────────────────────────────────────────

export const uploadSignatureRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  size:     z.number().int().min(1).max(20 * 1024 * 1024),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
});

// ── Task output schemas (used by orchestrator to validate child results) ──────

export const cropImageOutputSchema = z.object({
  output_image__out: z.string().url(),
});

export const geminiOutputSchema = z.object({
  response__out: z.string(),
});
