// trigger/node.execute.ts
// Per-node fan-out task. Fires when all upstream nodes are terminal.
// On completion it immediately triggers any successor whose upstreams are all done.

import { task, tasks, idempotencyKeys } from "@trigger.dev/sdk";
import { prisma }    from "@/lib/prisma";
import { runTag, nodeTag } from "@/lib/realtime/tags";
import type { CanvasNode, CanvasEdge } from "@/lib/nodes/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NodeExecuteInput {
  runId:             string;
  workflowId:        string;
  nodeId:            string;
  subgraphNodeCount: number;
  snapshot:          { nodes: CanvasNode[]; edges: CanvasEdge[] };
  manualValues:      Record<string, Record<string, unknown>>;
}

type InEdges  = Map<string, Array<{ source: string; sourceHandle: string; targetHandle: string }>>;
type OutEdges = Map<string, Array<{ target: string; sourceHandle: string; targetHandle: string }>>;

// ── Adjacency map builder ─────────────────────────────────────────────────────

function buildAdjacency(edges: CanvasEdge[]) {
  const outEdges: OutEdges = new Map();
  const inEdges:  InEdges  = new Map();
  for (const e of edges) {
    if (!outEdges.has(e.source)) outEdges.set(e.source, []);
    outEdges.get(e.source)!.push({ target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle });
    if (!inEdges.has(e.target)) inEdges.set(e.target, []);
    inEdges.get(e.target)!.push({ source: e.source, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle });
  }
  return { outEdges, inEdges };
}

// ── triggerReadySuccessors ────────────────────────────────────────────────────

async function triggerReadySuccessors(
  payload:  NodeExecuteInput,
  outEdges: OutEdges,
  inEdges:  InEdges,
) {
  const { runId, workflowId, nodeId, subgraphNodeCount, snapshot, manualValues } = payload;
  const successorIds = [...new Set((outEdges.get(nodeId) ?? []).map((e) => e.target))];

  for (const succId of successorIds) {
    const upstreamIds = [...new Set((inEdges.get(succId) ?? []).map((e) => e.source))];
    if (upstreamIds.length === 0) continue;

    const doneCount = await prisma.nodeRun.count({
      where: {
        runId,
        nodeId: { in: upstreamIds },
        status: { in: ["SUCCESS", "FAILED", "SKIPPED"] },
      },
    });
    if (doneCount < upstreamIds.length) continue;

    const iKey = await idempotencyKeys.create(`${runId}-${succId}`, { scope: "global" });
    await tasks.trigger(
      "node.execute",
      { runId, workflowId, nodeId: succId, subgraphNodeCount, snapshot, manualValues } satisfies NodeExecuteInput,
      { tags: [runTag(runId), nodeTag(succId)], idempotencyKey: iKey }
    );
  }
}

// ── checkAndFinalizeWorkflowRun ───────────────────────────────────────────────

async function checkAndFinalizeWorkflowRun(runId: string, totalCount: number) {
  await prisma.$transaction(async (tx) => {
    const terminal = await tx.nodeRun.count({
      where: { runId, status: { in: ["SUCCESS", "FAILED", "SKIPPED"] } },
    });
    if (terminal < totalCount) return;

    const [failedCnt, successCnt, workflowRun] = await Promise.all([
      tx.nodeRun.count({ where: { runId, status: "FAILED" } }),
      tx.nodeRun.count({ where: { runId, status: "SUCCESS" } }),
      tx.workflowRun.findUnique({ where: { id: runId }, select: { startedAt: true } }),
    ]);

    const finalStatus: "SUCCESS" | "FAILED" | "PARTIAL" =
      failedCnt > 0 && successCnt > 0 ? "PARTIAL" : failedCnt > 0 ? "FAILED" : "SUCCESS";

    await tx.workflowRun.updateMany({
      where: { id: runId, status: "RUNNING" },
      data: {
        status:     finalStatus as any,
        finishedAt: new Date(),
        durationMs: Date.now() - (workflowRun?.startedAt?.getTime() ?? Date.now()),
      },
    });
  });
}

// ── resolveNumber helper ──────────────────────────────────────────────────────

function resolveNumber(
  inputs:    Record<string, unknown>,
  handleId:  string,
  dataValue: number | null,
  fallback:  number
): number {
  const fromEdge = inputs[handleId];
  if (typeof fromEdge === "number") return fromEdge;
  if (dataValue !== null && dataValue !== undefined) return dataValue;
  return fallback;
}

// ── Task ──────────────────────────────────────────────────────────────────────

export const nodeExecuteTask = task({
  id:          "node.execute",
  maxDuration: 600,
  retry:       { maxAttempts: 1 },

  onFailure: async ({ payload, error }: { payload: NodeExecuteInput; error: unknown }) => {
    const { runId, nodeId, subgraphNodeCount, snapshot } = payload;

    await prisma.nodeRun.updateMany({
      where: { runId, nodeId, status: "RUNNING" },
      data:  { status: "FAILED", error: String(error), finishedAt: new Date() },
    });

    const { outEdges, inEdges } = buildAdjacency(snapshot.edges);
    await triggerReadySuccessors(payload, outEdges, inEdges);
    await checkAndFinalizeWorkflowRun(runId, subgraphNodeCount);
  },

  run: async (payload: NodeExecuteInput) => {
    const { runId, workflowId, nodeId, subgraphNodeCount, snapshot, manualValues } = payload;
    const { nodes, edges } = snapshot;

    // ── Build adjacency maps ────────────────────────────────────────────────
    const { outEdges, inEdges } = buildAdjacency(edges);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const node    = nodeMap.get(nodeId);

    if (!node) {
      await checkAndFinalizeWorkflowRun(runId, subgraphNodeCount);
      return;
    }

    // ── Fetch upstream NodeRun rows from DB ────────────────────────────────
    const upstreamNodeIds = [...new Set((inEdges.get(nodeId) ?? []).map((e) => e.source))];
    const upstreamRuns    = upstreamNodeIds.length > 0
      ? await prisma.nodeRun.findMany({ where: { runId, nodeId: { in: upstreamNodeIds } } })
      : [];

    const upstreamByNodeId = new Map(upstreamRuns.map((r) => [r.nodeId, r]));

    // ── Skip if any upstream failed or was skipped ─────────────────────────
    const hasFailedUpstream = upstreamRuns.some(
      (r) => r.status === "FAILED" || r.status === "SKIPPED"
    );

    if (hasFailedUpstream) {
      await prisma.nodeRun.upsert({
        where:  { runId_nodeId: { runId, nodeId } },
        create: { runId, nodeId, nodeType: node.type, status: "SKIPPED", inputs: {}, startedAt: new Date(), finishedAt: new Date(), durationMs: 0 },
        update: {},
      });
      await triggerReadySuccessors(payload, outEdges, inEdges);
      await checkAndFinalizeWorkflowRun(runId, subgraphNodeCount);
      return;
    }

    // ── Resolve inputs from upstream outputs + manual overlay ─────────────
    const resolved: Record<string, unknown> = {};
    for (const edge of inEdges.get(nodeId) ?? []) {
      const upRun = upstreamByNodeId.get(edge.source);
      const upOut = (upRun?.output as Record<string, unknown> | null) ?? {};
      const value = upOut[edge.sourceHandle];
      if (edge.targetHandle === "vision__in") {
        if (!resolved["vision__in"]) resolved["vision__in"] = [];
        (resolved["vision__in"] as unknown[]).push(value);
      } else {
        resolved[edge.targetHandle] = value;
      }
    }
    for (const [k, v] of Object.entries(manualValues[nodeId] ?? {})) {
      if (resolved[k] === undefined) resolved[k] = v;
    }

    const startMs = Date.now();

    // ── response ───────────────────────────────────────────────────────────
    if (node.type === "response") {
      const nodeRunRow = await prisma.nodeRun.create({
        data: {
          runId, nodeId, nodeType: node.type, status: "RUNNING",
          inputs: resolved as any, startedAt: new Date(),
        },
      });
      const output = { result__out: resolved["result__in"] };
      await prisma.nodeRun.update({
        where: { id: nodeRunRow.id },
        data:  { status: "SUCCESS", output: output as any, durationMs: Date.now() - startMs, finishedAt: new Date() },
      });
      await triggerReadySuccessors(payload, outEdges, inEdges);
      await checkAndFinalizeWorkflowRun(runId, subgraphNodeCount);
      return output;
    }

    // ── crop_image ─────────────────────────────────────────────────────────
    if (node.type === "crop_image") {
      const inputImage = (resolved["image__in"] as string | undefined) ?? node.data.input.image.value ?? null;

      if (!inputImage) {
        await prisma.nodeRun.upsert({
          where:  { runId_nodeId: { runId, nodeId } },
          create: { runId, nodeId, nodeType: node.type, status: "FAILED", inputs: resolved as any, error: "No input image provided", startedAt: new Date(), finishedAt: new Date(), durationMs: 0 },
          update: {},
        });
        await triggerReadySuccessors(payload, outEdges, inEdges);
        await checkAndFinalizeWorkflowRun(runId, subgraphNodeCount);
        return;
      }

      const xVal = resolveNumber(resolved, "x__in",      node.data.params.x.value,      0);
      const yVal = resolveNumber(resolved, "y__in",      node.data.params.y.value,      0);
      const wVal = resolveNumber(resolved, "width__in",  node.data.params.width.value,  100);
      const hVal = resolveNumber(resolved, "height__in", node.data.params.height.value, 100);

      const nodeRunRow = await prisma.nodeRun.create({
        data: {
          runId, nodeId, nodeType: node.type, status: "RUNNING",
          inputs: { image: inputImage, x: xVal, y: yVal, width: wVal, height: hVal } as any,
          startedAt: new Date(),
        },
      });

      try {
        await prisma.$disconnect();   // release connection before checkpoint — Neon closes idle TCP sockets
        const handle = await tasks.triggerAndWait(
          "node.cropImage",
          { inputImage, x: xVal, y: yVal, w: wVal, h: hVal, nodeId, runId },
          { tags: [runTag(runId), nodeTag(nodeId)] }
        );
        if (!handle.ok) throw new Error(String((handle as any).error ?? "cropImage task failed"));
        const output = handle.output as Record<string, unknown>;
        await prisma.nodeRun.update({
          where: { id: nodeRunRow.id },
          data:  { status: "SUCCESS", output: output as any, durationMs: Date.now() - startMs, finishedAt: new Date() },
        });
      } catch (err) {
        await prisma.nodeRun.update({
          where: { id: nodeRunRow.id },
          data:  { status: "FAILED", error: err instanceof Error ? err.message : String(err), durationMs: Date.now() - startMs, finishedAt: new Date() },
        });
        await triggerReadySuccessors(payload, outEdges, inEdges);
        await checkAndFinalizeWorkflowRun(runId, subgraphNodeCount);
        return;
      }

      await triggerReadySuccessors(payload, outEdges, inEdges);
      await checkAndFinalizeWorkflowRun(runId, subgraphNodeCount);
      return;
    }

    // ── gemini ─────────────────────────────────────────────────────────────
    if (node.type === "gemini") {
      const prompt = (resolved["prompt__in"] as string | undefined)
        ?? (node.data.prompt.connected ? "" : node.data.prompt.value ?? "");
      const systemPrompt = (resolved["system_prompt__in"] as string | undefined)
        ?? (node.data.systemPrompt.connected ? "" : node.data.systemPrompt.value ?? "");
      const connectedImages = (resolved["vision__in"] as string[] | string | undefined) ?? [];
      const images = [
        ...(Array.isArray(connectedImages) ? connectedImages : [connectedImages].filter(Boolean)),
        ...(node.data.vision.values ?? []),
      ].filter(Boolean) as string[];

      const nodeRunRow = await prisma.nodeRun.create({
        data: {
          runId, nodeId, nodeType: node.type, status: "RUNNING",
          inputs: { prompt, systemPrompt, images } as any,
          startedAt: new Date(),
        },
      });

      try {
        await prisma.$disconnect();   // release connection before checkpoint
        const handle = await tasks.triggerAndWait(
          "node.gemini",
          {
            model:        node.data.model,
            prompt,
            systemPrompt: systemPrompt || undefined,
            images,
            settings:     node.data.settings,
            nodeId,
            runId,
          },
          { tags: [runTag(runId), nodeTag(nodeId)] }
        );
        if (!handle.ok) throw new Error(String((handle as any).error ?? "gemini task failed"));
        const output = handle.output as Record<string, unknown>;
        await prisma.nodeRun.update({
          where: { id: nodeRunRow.id },
          data:  { status: "SUCCESS", output: output as any, durationMs: Date.now() - startMs, finishedAt: new Date() },
        });
      } catch (err) {
        await prisma.nodeRun.update({
          where: { id: nodeRunRow.id },
          data:  { status: "FAILED", error: err instanceof Error ? err.message : String(err), durationMs: Date.now() - startMs, finishedAt: new Date() },
        });
        await triggerReadySuccessors(payload, outEdges, inEdges);
        await checkAndFinalizeWorkflowRun(runId, subgraphNodeCount);
        return;
      }

      await triggerReadySuccessors(payload, outEdges, inEdges);
      await checkAndFinalizeWorkflowRun(runId, subgraphNodeCount);
      return;
    }

    // Unknown node type — treat as SKIPPED so the graph can still finalize
    await prisma.nodeRun.upsert({
      where:  { runId_nodeId: { runId, nodeId } },
      create: { runId, nodeId, nodeType: node.type, status: "SKIPPED", inputs: {}, startedAt: new Date(), finishedAt: new Date(), durationMs: 0 },
      update: {},
    });
    await triggerReadySuccessors(payload, outEdges, inEdges);
    await checkAndFinalizeWorkflowRun(runId, subgraphNodeCount);
  },
});
