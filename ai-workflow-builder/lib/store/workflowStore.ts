"use client";
// lib/store/workflowStore.ts
// Zustand store with zundo undo/redo for the canvas page

import { create } from "zustand";
import { temporal } from "zundo";
import { applyNodeChanges, applyEdgeChanges } from "reactflow";
import type { NodeChange, EdgeChange, Connection } from "reactflow";
import cuid from "cuid";
const createId = cuid;

import type {
  CanvasNode,
  CanvasEdge,
  NodeType,
  NodeRuntimeState,
  RunSummary,
  RunDetail,
  XY,
  DeepPartial,
  NodeData,
  RunScope,
} from "@/lib/nodes/types";
import { NODE_REGISTRY } from "@/lib/nodes/registry";
import { wouldCreateCycle } from "@/lib/executor/detectCycle";
import { DEBOUNCE_SAVE_MS, PRE_PLACED_NODE_IDS } from "@/lib/constants";
import { computeAutoArrangePositions } from "@/lib/layout/autoArrange";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkflowState {
  workflowId: string;
  workflowName: string;
  version: number;

  nodes: CanvasNode[];
  edges: CanvasEdge[];
  nodePositions: Record<string, XY>;

  selectedNodeIds: string[];
  pickerOpen: boolean;
  historyOpen: boolean;
  sidebarCollapsed: boolean;
  canvasMode: "pan" | "select";
  saveStatus: "idle" | "saving" | "saved";

  // Run-time overlay (NOT persisted, NOT in undo history)
  activeRunId: string | null;
  triggerRunId: string | null;
  publicAccessToken: string | null;
  nodeRuntime: Record<string, NodeRuntimeState>;

  // History
  runHistory: RunSummary[];
  expandedRunIds: Record<string, true>;
  runDetails: Record<string, RunDetail>;
  historyLoading: boolean;
  historyNextCursor: string | null;
}

export interface WorkflowActions {
  // Graph mutations (tracked by zundo)
  applyNodeChanges(changes: NodeChange[]): void;
  applyEdgeChanges(changes: EdgeChange[]): void;
  connect(params: Connection): void;
  addNode(type: NodeType, position: XY): void;
  deleteNode(id: string): void;
  updateNodeData(id: string, patch: DeepPartial<NodeData>): void;
  addField(kind: "text_field" | "image_field"): void;
  removeField(fieldId: string): void;
  renameField(fieldId: string, name: string): void;
  setFieldValue(fieldId: string, value: string): void;

  // Selection / UI
  setSelection(ids: string[]): void;
  togglePicker(open?: boolean): void;
  toggleHistory(open?: boolean): void;
  toggleSidebar(): void;
  setCanvasMode(mode: "pan" | "select"): void;
  setWorkflowName(name: string): void;

  // Persistence
  scheduleSave(): void;
  hardSave(): Promise<void>;
  importGraph(nodes: CanvasNode[], edges: CanvasEdge[]): void;

  // Runs
  startRun(scope: RunScope, selectedNodeIds?: string[]): Promise<void>;
  setNodeRuntime(nodeId: string, state: Partial<NodeRuntimeState>): void;
  finishRun(): void;
  failActiveRun(triggerStatus: string): void;
  resetRuntime(): void;

  // History
  loadHistoryPage(reset?: boolean): Promise<void>;
  expandRun(runId: string): Promise<void>;
  collapseRun(runId: string): void;

  // Layout
  autoArrange(): void;

  // Undo/redo (provided by zundo)
  undo(): void;
  redo(): void;
}

// ── Edge builder ──────────────────────────────────────────────────────────────

function buildEdgeId(params: Connection): string {
  return `e_${params.source}__${params.sourceHandle}__${params.target}__${params.targetHandle}`;
}

function buildEdge(params: Connection): CanvasEdge {
  return {
    id:           buildEdgeId(params),
    source:       params.source!,
    sourceHandle: params.sourceHandle!,
    target:       params.target!,
    targetHandle: params.targetHandle!,
    type:         "animated",
  };
}

// ── Handle kind lookup (for isValidConnection) ────────────────────────────────

function getHandleKindForNode(
  nodes: CanvasNode[],
  nodeId: string,
  handleId: string
): string | null {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const spec = NODE_REGISTRY[node.type];
  if (!spec) return null;

  if (spec.handles === "dynamic") {
    const handles = spec.deriveHandles?.(node.data) ?? [];
    return handles.find((h) => h.id === handleId)?.kind ?? null;
  }
  return spec.handles.find((h) => h.id === handleId)?.kind ?? null;
}

// ── Sync connected flags into node data after edge changes ────────────────────

function syncConnectedFlags(
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): CanvasNode[] {
  // Collect all target handles that have at least one edge
  const connectedTargets = new Set<string>(); // `${nodeId}::${handleId}`
  const visionConnections = new Map<string, string[]>(); // `${nodeId}` → array of `${srcNodeId}:${srcHandleId}`

  for (const e of edges) {
    connectedTargets.add(`${e.target}::${e.targetHandle}`);
    if (e.targetHandle === "vision__in") {
      const nodeKey = e.target;
      if (!visionConnections.has(nodeKey)) visionConnections.set(nodeKey, []);
      visionConnections.get(nodeKey)!.push(`${e.source}:${e.sourceHandle}`);
    }
  }

  return nodes.map((n) => {
    if (n.type === "crop_image") {
      return {
        ...n,
        data: {
          ...n.data,
          input: {
            image: {
              ...n.data.input.image,
              connected: connectedTargets.has(`${n.id}::image__in`),
            },
          },
          params: {
            x:      { ...n.data.params.x,      connected: connectedTargets.has(`${n.id}::x__in`) },
            y:      { ...n.data.params.y,       connected: connectedTargets.has(`${n.id}::y__in`) },
            width:  { ...n.data.params.width,   connected: connectedTargets.has(`${n.id}::width__in`) },
            height: { ...n.data.params.height,  connected: connectedTargets.has(`${n.id}::height__in`) },
          },
        },
      };
    }

    if (n.type === "gemini") {
      return {
        ...n,
        data: {
          ...n.data,
          prompt:       { ...n.data.prompt,       connected: connectedTargets.has(`${n.id}::prompt__in`) },
          systemPrompt: { ...n.data.systemPrompt, connected: connectedTargets.has(`${n.id}::system_prompt__in`) },
          video:        { ...n.data.video,         connected: connectedTargets.has(`${n.id}::video__in`) },
          audio:        { ...n.data.audio,         connected: connectedTargets.has(`${n.id}::audio__in`) },
          file:         { ...n.data.file,          connected: connectedTargets.has(`${n.id}::file__in`) },
          vision: {
            ...n.data.vision,
            connectedFrom: visionConnections.get(n.id) ?? [],
          },
        },
      };
    }

    return n;
  });
}

// ── Save debounce + concurrency lock ──────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveInProgress = false;
let pendingSave    = false;

// ── Store factory ─────────────────────────────────────────────────────────────

export type WorkflowStore = WorkflowState & WorkflowActions;

export const useWorkflowStore = create<WorkflowStore>()(
  temporal(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      workflowId:         "",
      workflowName:       "Untitled Workflow",
      version:            1,
      nodes:              [],
      edges:              [],
      nodePositions:      {},
      selectedNodeIds:    [],
      pickerOpen:         false,
      historyOpen:        false,
      sidebarCollapsed:   true,
      canvasMode:         "pan",
      saveStatus:         "idle",
      activeRunId:        null,
      triggerRunId:       null,
      publicAccessToken:  null,
      nodeRuntime:        {},
      runHistory:         [],
      expandedRunIds:     {},
      runDetails:         {},
      historyLoading:     false,
      historyNextCursor:  null,

      // ── Graph mutations ────────────────────────────────────────────────────

      applyNodeChanges(changes) {
        // "dimensions", "select", and "position" are not meaningful graph mutations.
        // Position changes are persisted separately on drag-stop via scheduleSave().
        const hasStructuralChange = changes.some(
          (c) => c.type !== "dimensions" && c.type !== "select" && c.type !== "position"
        );
        if (!hasStructuralChange) useWorkflowStore.temporal.getState().pause();
        set((s) => {
          const newNodes = applyNodeChanges(changes, s.nodes as any) as unknown as CanvasNode[];
          const updatedPositions = { ...s.nodePositions };
          for (const change of changes) {
            if (change.type === "position" && change.position) {
              updatedPositions[change.id] = change.position;
            }
          }
          return { nodes: newNodes, nodePositions: updatedPositions };
        });
        if (!hasStructuralChange) useWorkflowStore.temporal.getState().resume();
        if (hasStructuralChange) get().scheduleSave();
      },

      applyEdgeChanges(changes) {
        set((s) => {
          const edges = applyEdgeChanges(changes, s.edges as any) as unknown as CanvasEdge[];
          return { edges, nodes: syncConnectedFlags(s.nodes, edges) };
        });
        get().scheduleSave();
      },

      connect(params) {
        const { nodes, edges } = get();

        // Type-safe check
        const srcKind = getHandleKindForNode(nodes, params.source!, params.sourceHandle!);
        const tgtKind = getHandleKindForNode(nodes, params.target!, params.targetHandle!);
        if (srcKind && tgtKind && tgtKind !== "any" && srcKind !== tgtKind) return;

        // Cycle check
        if (wouldCreateCycle(edges, { source: params.source!, target: params.target! })) return;

        const newEdge = buildEdge(params);

        set((s) => {
          // Dedup by id
          if (s.edges.some((e) => e.id === newEdge.id)) return s;

          // Replace existing edge on the same single-connect target handle
          let updatedEdges = s.edges;
          if (newEdge.targetHandle !== "vision__in") {
            updatedEdges = updatedEdges.filter(
              (e) => !(e.target === newEdge.target && e.targetHandle === newEdge.targetHandle)
            );
          }

          const edges = [...updatedEdges, newEdge];
          return { edges, nodes: syncConnectedFlags(s.nodes, edges) };
        });

        get().scheduleSave();
      },

      addNode(type, position) {
        const spec = NODE_REGISTRY[type];
        if (!spec) return;
        const node: CanvasNode = {
          id:       `n_${type}_${createId()}`,
          type,
          position,
          data:     spec.defaultData() as any,
        };
        set((s) => ({
          nodes: [...s.nodes, node],
          nodePositions: { ...s.nodePositions, [node.id]: position },
        }));
        get().scheduleSave();
      },

      deleteNode(id) {
        if ((PRE_PLACED_NODE_IDS as readonly string[]).includes(id)) return;
        set((s) => {
          const nodes = s.nodes.filter((n) => n.id !== id);
          const edges = s.edges.filter((e) => e.source !== id && e.target !== id);
          return { nodes: syncConnectedFlags(nodes, edges), edges };
        });
        get().scheduleSave();
      },

      updateNodeData(id, patch) {
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === id ? { ...n, data: deepMerge(n.data, patch) as any } : n
          ),
        }));
        get().scheduleSave();
      },

      addField(kind) {
        set((s) => {
          const ri = s.nodes.find((n) => n.id === "n_request_inputs");
          if (!ri || ri.type !== "request_inputs") return s;
          const fields = ri.data.fields;
          const existingOfKind = fields.filter((f) => f.kind === kind).length;
          const name =
            kind === "text_field"
              ? existingOfKind === 0 ? "text_field" : `text_field_${existingOfKind + 1}`
              : existingOfKind === 0 ? "image_field" : `image_field_${existingOfKind + 1}`;

          const newField =
            kind === "text_field"
              ? { id: `f_${createId()}`, kind: "text_field" as const, name, value: "" }
              : { id: `f_${createId()}`, kind: "image_field" as const, name, value: null };

          return {
            nodes: s.nodes.map((n) =>
              n.id === "n_request_inputs" && n.type === "request_inputs"
                ? { ...n, data: { fields: [...n.data.fields, newField] } }
                : n
            ),
          };
        });
        get().scheduleSave();
      },

      removeField(fieldId) {
        set((s) => {
          const edges = s.edges.filter((e) => e.sourceHandle !== `${fieldId}__out`);
          return {
            edges,
            nodes: syncConnectedFlags(
              s.nodes.map((n) =>
                n.id === "n_request_inputs" && n.type === "request_inputs"
                  ? { ...n, data: { fields: n.data.fields.filter((f) => f.id !== fieldId) } }
                  : n
              ),
              edges
            ),
          };
        });
        get().scheduleSave();
      },

      renameField(fieldId, name) {
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === "n_request_inputs" && n.type === "request_inputs"
              ? { ...n, data: { fields: n.data.fields.map((f) => f.id === fieldId ? { ...f, name } : f) } }
              : n
          ),
        }));
        get().scheduleSave();
      },

      setFieldValue(fieldId, value) {
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === "n_request_inputs" && n.type === "request_inputs"
              ? { ...n, data: { fields: n.data.fields.map((f) => f.id === fieldId ? { ...f, value } : f) } }
              : n
          ),
        }));
        get().scheduleSave();
      },

      // ── Selection / UI ─────────────────────────────────────────────────────

      setSelection(ids) { set({ selectedNodeIds: ids }); },
      togglePicker(open) { set((s) => ({ pickerOpen: open ?? !s.pickerOpen })); },
      toggleHistory(open) { set((s) => ({ historyOpen: open ?? !s.historyOpen })); },
      toggleSidebar() { set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })); },
      setCanvasMode(mode) { set({ canvasMode: mode }); },
      setWorkflowName(name) {
        set({ workflowName: name });
        get().hardSave();
      },

      importGraph(nodes, edges) {
        const synced = syncConnectedFlags(nodes, edges);
        set({ nodes: synced, edges });
        get().scheduleSave();
      },

      // ── Persistence ────────────────────────────────────────────────────────

      scheduleSave() {
        set({ saveStatus: "saving" });
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          get().hardSave().catch(console.error);
        }, DEBOUNCE_SAVE_MS);
      },

      async hardSave() {
        // Concurrency lock: if a save is already in-flight, mark a pending save
        // and return. The in-flight save will re-trigger after it completes,
        // picking up the latest state at that point (preventing 409 conflicts).
        if (saveInProgress) {
          pendingSave = true;
          return;
        }
        saveInProgress = true;

        const { workflowId, nodes, edges, version } = get();
        if (!workflowId) {
          saveInProgress = false;
          return;
        }

        // Strip canvas-only nodes (e.g. sticky_note) — they are not in the DB schema
        const persistableNodes = nodes.filter((n) => {
          const spec = NODE_REGISTRY[n.type];
          return !spec?.canvasOnly;
        });

        const doSave = async (v: number) => {
          const res = await fetch(`/api/workflows/${workflowId}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ graph: { nodes: persistableNodes, edges }, version: v }),
          });
          return res;
        };

        try {
          let res = await doSave(version);

          if (res.ok) {
            const data = await res.json();
            set({ version: data.version, saveStatus: "saved" });
            setTimeout(() => {
              if (get().saveStatus === "saved") set({ saveStatus: "idle" });
            }, 1500);
            return;
          }

          if (res.status === 409) {
            const body = await res.json();
            if (body?.error?.code === "VERSION_CONFLICT") {
              // Server version has advanced (e.g. another tab saved first).
              // Sync to server's version and retry once — local canvas state wins.
              const serverVersion = body.error.currentVersion as number;
              set({ version: serverVersion });
              res = await doSave(serverVersion);
              if (res.ok) {
                const data = await res.json();
                set({ version: data.version, saveStatus: "saved" });
                setTimeout(() => {
                  if (get().saveStatus === "saved") set({ saveStatus: "idle" });
                }, 1500);
              }
            }
          }
        } catch (e) {
          console.error("[NextFlow] auto-save failed", e);
        } finally {
          saveInProgress = false;
          if (pendingSave) {
            pendingSave = false;
            get().hardSave().catch(console.error);
          }
        }
      },

      // ── Runs ───────────────────────────────────────────────────────────────

      async startRun(scope, selectedNodeIds) {
        const { workflowId, nodes } = get();

        // Build manualValues from Request-Inputs current field values
        const ri = nodes.find((n) => n.id === "n_request_inputs");
        const manualValues: Record<string, Record<string, unknown>> = {};
        if (ri && ri.type === "request_inputs") {
          manualValues["n_request_inputs"] = {};
          for (const f of ri.data.fields) {
            manualValues["n_request_inputs"][`${f.id}__out`] = f.value;
          }
        }

        const res = await fetch(`/api/workflows/${workflowId}/runs`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ scope, selectedNodeIds: selectedNodeIds ?? [], manualValues }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err?.error?.message ?? "Failed to start run");
        }

        const { runId, triggerRunId, publicAccessToken } = await res.json();
        // Pre-seed request_inputs as running — it executes inline (no Trigger.dev
        // child task) so it never emits an EXECUTING realtime event. The subscriber
        // flips it to success when the first downstream child task fires.
        set({
          activeRunId:  runId,
          triggerRunId,
          publicAccessToken,
          nodeRuntime: { n_request_inputs: { status: "running" } },
        });
        await get().loadHistoryPage(true);
      },

      setNodeRuntime(nodeId, state) {
        set((s) => ({
          nodeRuntime: {
            ...s.nodeRuntime,
            [nodeId]: { ...(s.nodeRuntime[nodeId] ?? { status: "idle" }), ...state },
          },
        }));
      },

      // Clears the active run lock without wiping nodeRuntime — results stay
      // visible on the canvas until the next run starts.
      finishRun() {
        set({ activeRunId: null, triggerRunId: null, publicAccessToken: null });
      },

      // Fire-and-forget: marks the DB WorkflowRun as FAILED so the user can
      // re-run immediately without waiting for the 330 s stale-run cleanup.
      failActiveRun(triggerStatus: string) {
        const { workflowId, activeRunId } = get();
        if (!workflowId || !activeRunId) return;
        fetch(`/api/workflows/${workflowId}/runs/${activeRunId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "FAILED",
            errorSummary: `Trigger.dev run ${triggerStatus} — no worker available or task timed out in queue.`,
          }),
        }).catch(() => {});
      },

      resetRuntime() {
        set({ activeRunId: null, triggerRunId: null, publicAccessToken: null, nodeRuntime: {} });
      },

      // ── History ────────────────────────────────────────────────────────────

      async loadHistoryPage(reset = false) {
        const { workflowId, historyNextCursor, historyLoading } = get();
        if (!workflowId || historyLoading) return;
        if (!reset && !historyNextCursor && get().runHistory.length > 0) return;

        set({ historyLoading: true });
        try {
          const cursor = reset ? "" : historyNextCursor ?? "";
          const url    = `/api/workflows/${workflowId}/runs?limit=20${cursor ? `&cursor=${cursor}` : ""}`;
          const res    = await fetch(url);
          if (!res.ok) return;
          const data   = await res.json();
          set((s) => ({
            runHistory:        reset ? data.runs : [...s.runHistory, ...data.runs],
            historyNextCursor: data.nextCursor,
          }));
        } finally {
          set({ historyLoading: false });
        }
      },

      async expandRun(runId) {
        set((s) => ({ expandedRunIds: { ...s.expandedRunIds, [runId]: true } }));
        if (get().runDetails[runId]) return; // already loaded

        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) return;
        const detail = await res.json();
        set((s) => ({ runDetails: { ...s.runDetails, [runId]: detail } }));
      },

      collapseRun(runId) {
        set((s) => {
          const next = { ...s.expandedRunIds };
          delete next[runId];
          return { expandedRunIds: next };
        });
      },

      undo() {
        const temporal = useWorkflowStore.temporal.getState();
        temporal.undo();
        temporal.pause();
        const { nodes, nodePositions } = useWorkflowStore.getState();
        useWorkflowStore.setState({
          nodes: nodes.map((n) => ({
            ...n,
            position: n.position ?? nodePositions[n.id] ?? { x: 100, y: 100 },
          })),
        });
        temporal.resume();
        get().scheduleSave();
      },
      redo() {
        const temporal = useWorkflowStore.temporal.getState();
        temporal.redo();
        temporal.pause();
        const { nodes, nodePositions } = useWorkflowStore.getState();
        useWorkflowStore.setState({
          nodes: nodes.map((n) => ({
            ...n,
            position: n.position ?? nodePositions[n.id] ?? { x: 100, y: 100 },
          })),
        });
        temporal.resume();
        get().scheduleSave();
      },

      autoArrange() {
        const { nodes, edges } = get();
        const positions = computeAutoArrangePositions(nodes, edges);
        const updatedPositions = { ...get().nodePositions, ...positions };
        set({
          nodes: nodes.map((n) =>
            positions[n.id] ? { ...n, position: positions[n.id] } : n
          ),
          nodePositions: updatedPositions,
        });
        get().scheduleSave();
      },
    }),
    {
      // Partialize: only structural graph state is tracked in undo history.
      // Node positions are excluded (§16.1).
      partialize: (state) => ({
        nodes: state.nodes.map(({ position: _p, ...n }) => n),
        edges: state.edges,
      }),
    }
  )
);

// ── Deep merge helper ─────────────────────────────────────────────────────────

function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };
  for (const key in source) {
    const srcVal = source[key];
    const tgtVal = (target as Record<string, unknown>)[key];
    if (srcVal === undefined) continue;
    if (
      srcVal !== null &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === "object" &&
      !Array.isArray(tgtVal)
    ) {
      (result as any)[key] = deepMerge(tgtVal as object, srcVal as object);
    } else {
      (result as any)[key] = srcVal;
    }
  }
  return result;
}
