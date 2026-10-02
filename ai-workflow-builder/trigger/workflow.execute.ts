// trigger/workflow.execute.ts
// Slim launcher: resolves request_inputs inline, spawns inDegree-0 task nodes
// via fire-and-forget, then polls until the workflow finishes or times out.

import { task, batch, wait, idempotencyKeys } from "@trigger.dev/sdk";
import { prisma }       from "@/lib/prisma";
import { runTag, nodeTag } from "@/lib/realtime/tags";
import type { CanvasNode, CanvasEdge } from "@/lib/nodes/types";
import { buildFullSubgraph, buildPartialSubgraph } from "@/lib/executor/buildSubgraph";
import { nodeExecuteTask } from "./node.execute";

// ── Input/Output types ────────────────────────────────────────────────────────

interface ExecuteInput {
  runId:              string;
  workflowId:         string;
  scope:              "FULL" | "PARTIAL" | "SINGLE";
  selectedNodeIds:    string[];
  snapshot:           { nodes: CanvasNode[]; edges: CanvasEdge[] };
  manualValues:       Record<string, Record<string, unknown>>;
  preResolvedOutputs: Record<string, Record<string, unknown>>;
}

// ── Orchestrator task ─────────────────────────────────────────────────────────

export const workflowExecuteTask = task({
  id:          "workflow.execute",
  maxDuration: 300,

  onFailure: async ({ payload, error }: { payload: ExecuteInput; error: unknown }) => {
    await prisma.workflowRun.updateMany({
      where: { id: payload.runId, status: "RUNNING" },
      data:  {
        status:       "FAILED",
        finishedAt:   new Date(),
        errorSummary: error instanceof Error ? error.message : String(error),
      },
    });
  },

  run: async (input: ExecuteInput) => {
    const { runId, workflowId, scope, selectedNodeIds, snapshot, manualValues } = input;
    const { nodes, edges } = snapshot;
    const startedAt = Date.now();

    // ── Build subgraph ──────────────────────────────────────────────────────
    const subgraph = scope === "FULL"
      ? buildFullSubgraph(nodes, edges)
      : buildPartialSubgraph(nodes, edges, selectedNodeIds);

    const { nodes: subNodes, edges: subEdges } = subgraph;

    // ── Build adjacency maps ────────────────────────────────────────────────
    const outEdges = new Map<string, Array<{ target: string; sourceHandle: string; targetHandle: string }>>();
    const inEdges  = new Map<string, Array<{ source: string; sourceHandle: string; targetHandle: string }>>();

    for (const e of subEdges) {
      if (!outEdges.has(e.source)) outEdges.set(e.source, []);
      outEdges.get(e.source)!.push({ target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle });
      if (!inEdges.has(e.target)) inEdges.set(e.target, []);
      inEdges.get(e.target)!.push({ source: e.source, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle });
    }

    const nodeMap = new Map(subNodes.map((n) => [n.id, n]));

    // ── Write synthetic SUCCESS NodeRun rows for preResolvedOutputs ────────
    // Only for nodes that are actually in the subgraph (guards against count skew).
    for (const [nodeId, output] of Object.entries(input.preResolvedOutputs)) {
      if (!nodeMap.has(nodeId)) continue;
      const node = nodeMap.get(nodeId)!;
      await prisma.nodeRun.upsert({
        where:  { runId_nodeId: { runId, nodeId } },
        create: {
          runId, nodeId, nodeType: node.type, status: "SUCCESS",
          inputs: {}, output: output as any,
          startedAt: new Date(), finishedAt: new Date(), durationMs: 0,
        },
        update: {},
      });
    }

    // ── Compute inDegree for all subgraph nodes ─────────────────────────────
    const inDegree = new Map<string, number>();
    for (const n of subNodes) {
      inDegree.set(n.id, (inEdges.get(n.id) ?? []).length);
    }

    // ── Run request_inputs inline if it is a seed node ─────────────────────
    async function createNodeRun(nodeId: string, nodeType: string, inputs: unknown) {
      return prisma.nodeRun.create({
        data: { runId, nodeId, nodeType, status: "RUNNING", inputs: inputs as any, startedAt: new Date() },
      });
    }

    async function finishNodeRun(
      id: string,
      status: "SUCCESS" | "FAILED" | "SKIPPED",
      output: unknown,
      error: string | null,
      startMs: number
    ) {
      return prisma.nodeRun.update({
        where: { id },
        data: {
          status:     status as any,
          output:     output as any,
          error:      error ?? undefined,
          durationMs: Date.now() - startMs,
          finishedAt: new Date(),
        },
      });
    }

    if (nodeMap.has("n_request_inputs") && (inDegree.get("n_request_inputs") ?? 1) === 0) {
      const node        = nodeMap.get("n_request_inputs")!;
      const startMs     = Date.now();
      const nodeInputs  = manualValues["n_request_inputs"] ?? {};
      const output: Record<string, unknown> = {};

      if (node.type === "request_inputs") {
        for (const field of node.data.fields) {
          const handleId   = `${field.id}__out`;
          output[handleId] = nodeInputs[handleId] ?? field.value;
        }
      }

      const row = await createNodeRun("n_request_inputs", node.type, nodeInputs);
      await finishNodeRun(row.id, "SUCCESS", output, null, startMs);

      // Decrement successor inDegrees now that request_inputs has run
      for (const edge of outEdges.get("n_request_inputs") ?? []) {
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 1) - 1);
      }
    }

    // ── Collect inDegree=0 seeds (excluding request_inputs, already handled) ─
    const seeds: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0 && id !== "n_request_inputs") seeds.push(id);
    }

    const subgraphNodeCount = subNodes.length;

    // ── Spawn seed nodes (fire-and-forget) ────────────────────────────────
    if (seeds.length > 0) {
      await batch.triggerByTask(
        await Promise.all(
          seeds.map(async (nodeId) => ({
            task:    nodeExecuteTask,
            payload: {
              runId, workflowId, nodeId, subgraphNodeCount,
              snapshot: { nodes: subNodes, edges: subEdges },
              manualValues,
            } satisfies Parameters<typeof nodeExecuteTask.trigger>[0],
            options: {
              tags:           [runTag(runId), nodeTag(nodeId)],
              idempotencyKey: await idempotencyKeys.create(`${runId}-${nodeId}`, { scope: "global" }),
            },
          }))
        )
      );
    } else if (subgraphNodeCount === 0) {
      // Edge case: nothing to run — finalize immediately
      await prisma.workflowRun.updateMany({
        where: { id: runId, status: "RUNNING" },
        data:  { status: "SUCCESS", finishedAt: new Date(), durationMs: 0 },
      });
    }

    // ── Poll until workflow finishes (keeps this task alive for RealtimeSubscriber) ─
    let run: { status: string; finishedAt: Date | null; errorSummary: string | null } | null = null;
    for (let i = 0; i < 60; i++) {
      await prisma.$disconnect();   // release connection before checkpoint
      await wait.for({ seconds: 5 });
      run = await prisma.workflowRun.findUnique({
        where:  { id: runId },
        select: { status: true, finishedAt: true, errorSummary: true },
      });
      if (run?.status !== "RUNNING") break;
    }

    // Fetch response node output from DB — the subscriber's Path 1 (orchestrator
    // completion) reads responseOutput to populate nodeRuntime["n_response"].output.
    const responseNodeRun = await prisma.nodeRun.findUnique({
      where:  { runId_nodeId: { runId, nodeId: "n_response" } },
      select: { output: true },
    });

    return {
      status:         run?.status ?? "FAILED",
      durationMs:     Date.now() - startedAt,
      responseOutput: (responseNodeRun?.output as Record<string, unknown> | null) ?? null,
    };
  },
});
