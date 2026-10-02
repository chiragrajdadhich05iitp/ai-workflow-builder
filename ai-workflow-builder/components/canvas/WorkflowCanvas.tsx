"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  MiniMap,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { Map, Minimize2 } from "lucide-react";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import { wouldCreateCycle } from "@/lib/executor/detectCycle";
import { NODE_REGISTRY, getNodeHandles } from "@/lib/nodes/registry";
import type { CanvasNode, CanvasEdge, NodeType } from "@/lib/nodes/types";

import { RequestInputsNode } from "./nodes/RequestInputsNode";
import { CropImageNode }     from "./nodes/CropImageNode";
import { GeminiNode }        from "./nodes/GeminiNode";
import { ResponseNode }      from "./nodes/ResponseNode";
import { StickyNoteNode }    from "./nodes/StickyNoteNode";
import { AnimatedEdge }      from "./edges/AnimatedEdge";
import { BottomToolbar }     from "./BottomToolbar";
import { CanvasTopBar }      from "./CanvasTopBar";
import { SaveIndicator }     from "./SaveIndicator";

import { useRealtimeRunsWithTag } from "@trigger.dev/react-hooks";
import { runTag } from "@/lib/realtime/tags";
import { PRE_PLACED_NODE_IDS } from "@/lib/constants";

// ── Node / Edge type maps ─────────────────────────────────────────────────────

const NODE_TYPES = {
  request_inputs: RequestInputsNode,
  crop_image:     CropImageNode,
  gemini:         GeminiNode,
  response:       ResponseNode,
  sticky_note:    StickyNoteNode,
};

const EDGE_TYPES = {
  animated: AnimatedEdge,
};

// ── isValidConnection ─────────────────────────────────────────────────────────

function makeIsValidConnection(nodes: CanvasNode[], edges: CanvasEdge[]) {
  return (connection: Connection): boolean => {
    if (!connection.source || !connection.target) return false;
    if (connection.source === connection.target) return false;

    // Cycle check
    if (wouldCreateCycle(edges, { source: connection.source, target: connection.target })) {
      return false;
    }

    // Kind check
    const srcNode = nodes.find((n) => n.id === connection.source);
    const tgtNode = nodes.find((n) => n.id === connection.target);
    if (!srcNode || !tgtNode) return false;

    const srcSpec = NODE_REGISTRY[srcNode.type as NodeType];
    const tgtSpec = NODE_REGISTRY[tgtNode.type as NodeType];
    if (!srcSpec || !tgtSpec) return true;

    const srcHandles = getNodeHandles(srcSpec, srcNode.data);
    const tgtHandles = getNodeHandles(tgtSpec, tgtNode.data);
    const srcH = srcHandles.find((h) => h.id === connection.sourceHandle);
    const tgtH = tgtHandles.find((h) => h.id === connection.targetHandle);

    if (!srcH || !tgtH) return true;
    if (tgtH.kind === "any") return true;
    return srcH.kind === tgtH.kind;
  };
}

// ── Realtime hook wrapper ─────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CRASHED", "CANCELED", "TIMED_OUT", "EXPIRED"]);

function RealtimeSubscriber() {
  const {
    triggerRunId, publicAccessToken, setNodeRuntime,
    activeRunId, loadHistoryPage, finishRun, failActiveRun, nodeRuntime,
  } = useWorkflowStore();

  // Keep a ref so the effect can read current nodeRuntime without it being a dep.
  // Including nodeRuntime in deps caused an infinite re-render loop:
  // setNodeRuntime → new nodeRuntime ref → effect re-runs → setNodeRuntime again.
  const nodeRuntimeRef = useRef(nodeRuntime);
  nodeRuntimeRef.current = nodeRuntime;

  // Tracks whether n_request_inputs has been flipped to "success" this run.
  const requestInputsFlippedRef = useRef(false);

  // Reset per-run refs whenever a new run starts.
  const prevActiveRunIdRef = useRef<string | null>(null);
  if (activeRunId !== prevActiveRunIdRef.current) {
    prevActiveRunIdRef.current = activeRunId;
    requestInputsFlippedRef.current = false;
  }

  const tag = activeRunId ? runTag(activeRunId) : null;

  const { runs } = useRealtimeRunsWithTag(
    tag ?? "",
    {
      accessToken: publicAccessToken ?? undefined,
      enabled:     !!tag && !!publicAccessToken,
    } as any
  );

  useEffect(() => {
    if (!runs) return;

    // Trigger.dev runs are usually sorted newest first, but sort them by createdAt descending to be safe.
    const sortedRuns = [...runs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const seenNodes = new Set<string>();

    for (const run of sortedRuns) {
      // Extract nodeId from run tags like "node:n_crop_1"
      const nodeTag = run.tags?.find((t: string) => t.startsWith("node:"));
      const nodeId  = nodeTag?.replace("node:", "");

      if (!nodeId) {
        if (seenNodes.has("orchestrator")) continue;
        seenNodes.add("orchestrator");

        // This is the orchestrator (workflow.execute) — no node: tag.
        // console.log(`[NextFlow] Orchestrator | status=${run.status} id=${run.id}`);
        if (run.id === triggerRunId && TERMINAL_STATUSES.has(run.status)) {
          // Sweep any nodes still in "running" state to a final state.
          // This handles cases where the orchestrator fails/crashes before a
          // child task fires its own terminal event (e.g. n_request_inputs when
          // the orchestrator fails inline, or any node on a TIMED_OUT/EXPIRED run).
          const isSuccess = run.status === "COMPLETED";
          for (const [nid, state] of Object.entries(nodeRuntimeRef.current)) {
            if (state.status === "running") {
              setNodeRuntime(nid, { status: isSuccess ? "success" : "failed" });
            }
          }
          // Populate the response node from the orchestrator's return value.
          // n_response runs inline (no child task), so it never gets a node: tag
          // event — we recover its output from the orchestrator's own run.output.
          if (isSuccess) {
            const orchOut = run.output as { responseOutput?: Record<string, unknown> | null } | undefined;
            if (orchOut?.responseOutput) {
              setNodeRuntime("n_response", { status: "success", output: orchOut.responseOutput });
            }
          }
          // For non-success terminals (EXPIRED, FAILED, CRASHED, TIMED_OUT, CANCELED),
          // immediately mark the DB run as FAILED so the user can re-run right away
          // without waiting for the 330 s stale-run auto-cleanup.
          if (!isSuccess) failActiveRun(run.status);
          finishRun();
          loadHistoryPage(true);
        }
        continue;
      }

      // Only process the most recent run for each specific child node
      if (seenNodes.has(nodeId)) continue;
      seenNodes.add(nodeId);

      const status = run.status as string;
      const isTerminal = TERMINAL_STATUSES.has(status);
      const isActive = !isTerminal; // Treat anything not terminal as active/running

      if (isActive) {
        // request_inputs completes inline before any child task can start.
        // Flip it to "success" only once per run via ref — avoids needing
        // nodeRuntime in the effect dep array.
        if (!requestInputsFlippedRef.current) {
          requestInputsFlippedRef.current = true;
          setNodeRuntime("n_request_inputs", { status: "success" });
        }
        
        // Stamp startedAt only the first time this node goes active.
        // Preserve the startedAt if it was already running to avoid resetting the timer.
        const currentState = nodeRuntimeRef.current[nodeId];
        if (currentState?.status !== "running") {
          // console.log(`[NextFlow] Node ACTIVE  | id=${nodeId} status=${status}`);
          setNodeRuntime(nodeId, { status: "running", startedAt: Date.now() });
        }
      } else if (status === "COMPLETED") {
        // console.log(`[NextFlow] Node DONE    | id=${nodeId} durationMs=${run.durationMs}`);
        const output = run.output as Record<string, unknown> | undefined;
        setNodeRuntime(nodeId, {
          status:  "success",
          output,
          durationMs: run.durationMs ?? undefined,
        });
      } else if (isTerminal) {
        // console.log(`[NextFlow] Node FAILED  | id=${nodeId} error=${run.error?.message} status=${status}`);
        setNodeRuntime(nodeId, {
          status: "failed",
          error:  run.error?.message ?? `Task ${status}`,
        });
      }
    }
  // nodeRuntime intentionally excluded — current value is accessed via
  // nodeRuntimeRef to avoid the infinite re-render loop described above.
  }, [runs, triggerRunId, setNodeRuntime, loadHistoryPage, finishRun]);

  return null;
}

// ── Main canvas ───────────────────────────────────────────────────────────────

export function WorkflowCanvas() {
  const {
    nodes, edges,
    applyNodeChanges, applyEdgeChanges, connect,
    deleteNode, setSelection, togglePicker, pickerOpen,
    selectedNodeIds, autoArrange, canvasMode, scheduleSave,
    undo, redo,
  } = useWorkflowStore();

  const [minimapOpen, setMinimapOpen] = useState(true);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Block delete for pre-placed nodes
      const filtered = changes.filter((c) => {
        if (c.type === "remove" && (PRE_PLACED_NODE_IDS as readonly string[]).includes(c.id)) {
          return false;
        }
        return true;
      });
      applyNodeChanges(filtered);
    },
    [applyNodeChanges]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => applyEdgeChanges(changes),
    [applyEdgeChanges]
  );

  const onConnect = useCallback(
    (params: Connection) => connect(params),
    [connect]
  );

  const isValidConnection = useCallback(
    (conn: Connection) => makeIsValidConnection(nodes, edges)(conn),
    [nodes, edges]
  );

  // Close picker on canvas click
  const onPaneClick = useCallback(() => {
    if (pickerOpen) togglePicker(false);
    setSelection([]);
  }, [pickerOpen, togglePicker, setSelection]);

  const onSelectionChange = useCallback(
    ({ nodes: selNodes }: { nodes: any[] }) => {
      setSelection(selNodes.map((n) => n.id));
    },
    [setSelection]
  );

  // Global keyboard shortcuts — fire regardless of which element is focused.
  // Skip all shortcuts when the user is typing in an input / textarea / contenteditable.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isEditingText =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && !e.shiftKey && e.key === "z" && !isEditingText) {
        e.preventDefault();
        undo();
        return;
      }

      if (isMod && (e.key === "y" || (e.shiftKey && e.key === "z")) && !isEditingText) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.shiftKey && e.key === "A" && !isEditingText) {
        e.preventDefault();
        autoArrange();
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && !isEditingText) {
        for (const id of selectedNodeIds) {
          if (!(PRE_PLACED_NODE_IDS as readonly string[]).includes(id)) {
            deleteNode(id);
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, autoArrange, deleteNode, selectedNodeIds]);

  return (
    <div className="relative flex-1 h-full" tabIndex={-1} style={{ background: "var(--canvas-bg)" }}>
      <CanvasTopBar />

      <ReactFlow
        nodes={nodes as any}
        edges={edges as any}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        defaultEdgeOptions={{ type: "animated" }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
        panOnDrag={canvasMode === "pan"}
        selectionOnDrag={canvasMode === "select"}
        onNodeDragStop={() => scheduleSave()}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={2} color="#798396" />
        {minimapOpen && (
          <MiniMap
            style={{
              background: "#12121A",
              border: "1px solid #2A2A3A",
              borderRadius: "8px",
            }}
            nodeColor={(node) =>
            node.type === "crop_image" || node.type === "gemini"
              ? "#6366F1"
              : "#3D3D55"
          }
            maskColor="rgba(0,0,0,0.4)"
            position="bottom-right"
          />
        )}
      </ReactFlow>

      {/* Collapse button — small, sits at top-right corner of the open minimap */}
      {minimapOpen && (
        <button
          onClick={() => setMinimapOpen(false)}
          className="absolute z-40 w-6 h-6 flex items-center justify-center bg-white border border-gray-200 rounded-md shadow text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          style={{ bottom: "158px", right: "6px" }}
          title="Collapse map"
        >
          <Minimize2 size={11} />
        </button>
      )}

      {/* Map button — shown only when minimap is collapsed */}
      {!minimapOpen && (
        <button
          onClick={() => setMinimapOpen(true)}
          className="absolute bottom-6 right-4 z-40 w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl shadow-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          title="Show map"
        >
          <Map size={18} />
        </button>
      )}

      <BottomToolbar />
      <SaveIndicator />
      <RealtimeSubscriber />
    </div>
  );
}
