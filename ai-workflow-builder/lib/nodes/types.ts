// lib/nodes/types.ts

export type HandleKind =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "number"
  | "any";

// "any" is a wildcard — only valid on TARGET handles (e.g. Response.result__in).
// isValidConnection treats target.kind === "any" as accepting any source kind.

export type ConnectableValue<T> = { value: T | null; connected: boolean };
export type MultiConnectableValue<T> = { values: T[]; connectedFrom: string[] };

export type RequestInputField =
  | { id: string; kind: "text_field"; name: string; value: string }
  | { id: string; kind: "image_field"; name: string; value: string | null };

export interface RequestInputsData {
  fields: RequestInputField[];
}

export interface CropImageData {
  input: { image: ConnectableValue<string> };
  params: {
    x: ConnectableValue<number>;
    y: ConnectableValue<number>;
    width: ConnectableValue<number>;
    height: ConnectableValue<number>;
  };
}

export interface GeminiData {
  model: string;
  prompt: ConnectableValue<string>;
  systemPrompt: ConnectableValue<string>;
  vision: MultiConnectableValue<string>;
  video: ConnectableValue<string>;
  audio: ConnectableValue<string>;
  file: ConnectableValue<string>;
  settings: {
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
  };
  settingsCollapsed: boolean;
}

export interface ResponseData {
  label: string;
  result: unknown | null;
}

export interface StickyNoteData {
  text: string;
  color: string;
}

export type NodeType =
  | "request_inputs"
  | "crop_image"
  | "gemini"
  | "response"
  | "sticky_note";

export type NodeData =
  | RequestInputsData
  | CropImageData
  | GeminiData
  | ResponseData
  | StickyNoteData;

export interface XY {
  x: number;
  y: number;
}

export type CanvasNode =
  | { id: string; type: "request_inputs"; position: XY; data: RequestInputsData }
  | { id: string; type: "crop_image"; position: XY; data: CropImageData }
  | { id: string; type: "gemini"; position: XY; data: GeminiData }
  | { id: string; type: "response"; position: XY; data: ResponseData }
  | { id: string; type: "sticky_note"; position: XY; data: StickyNoteData };

export interface CanvasEdge {
  id: string;
  source: string;       // nodeId
  sourceHandle: string; // handleId
  target: string;
  targetHandle: string;
  type?: "animated";
}

// Runtime overlay — NOT persisted, held only in Zustand
export interface NodeRuntimeState {
  status: "idle" | "running" | "success" | "failed" | "skipped";
  output?: unknown;
  error?: string;
  durationMs?: number;
  startedAt?: number; // epoch ms
}

export type RunScope = "FULL" | "PARTIAL" | "SINGLE";
export type RunStatus = "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL" | "CANCELLED";
export type NodeStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";

export interface RunSummary {
  id: string;
  scope: RunScope;
  status: RunStatus;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
  selectedNodeIds: string[];
}

export interface NodeRunDetail {
  id: string;
  nodeId: string;
  nodeType: string;
  status: NodeStatus;
  inputs: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  durationMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface RunDetail extends RunSummary {
  nodeRuns: NodeRunDetail[];
}

// Deep partial utility
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;
