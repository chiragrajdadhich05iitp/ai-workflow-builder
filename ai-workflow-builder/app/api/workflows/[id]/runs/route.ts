// app/api/workflows/[id]/runs/route.ts
// GET  /api/workflows/:id/runs — paged run history
// POST /api/workflows/:id/runs — start a run

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { runStartSchema } from "@/lib/nodes/schema";
import { validateGraph } from "@/lib/executor/validateGraph";
import { tasks } from "@trigger.dev/sdk/v3";
import { runTag } from "@/lib/realtime/tags";
import { HISTORY_PAGE_SIZE } from "@/lib/constants";

type Params = { params: { id: string } };

// ── GET /api/workflows/:id/runs ───────────────────────────────────────────────

export async function GET(req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflow = await prisma.workflow.findUnique({ where: { id: params.id } });
  if (!workflow || workflow.userId !== userId) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const url    = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);

  let cursorWhere = {};
  if (cursor) {
    try {
      const [startedAt, runId] = Buffer.from(cursor, "base64").toString().split("|");
      cursorWhere = {
        OR: [
          { startedAt: { lt: new Date(startedAt) } },
          { startedAt: new Date(startedAt), id: { lt: runId } },
        ],
      };
    } catch { /* ignore bad cursor */ }
  }

  const runs = await prisma.workflowRun.findMany({
    where:   { workflowId: params.id, ...cursorWhere },
    orderBy: { startedAt: "desc" },
    take:    limit + 1,
    select: {
      id:             true,
      scope:          true,
      status:         true,
      durationMs:     true,
      startedAt:      true,
      finishedAt:     true,
      selectedNodeIds:true,
    },
  });

  const hasMore = runs.length > limit;
  const page    = hasMore ? runs.slice(0, limit) : runs;
  const last    = page[page.length - 1];
  const nextCursor = hasMore && last
    ? Buffer.from(`${last.startedAt.toISOString()}|${last.id}`).toString("base64")
    : null;

  return NextResponse.json({ runs: page, nextCursor });
}

// ── POST /api/workflows/:id/runs ──────────────────────────────────────────────

export async function POST(req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflow = await prisma.workflow.findUnique({ where: { id: params.id } });
  if (!workflow || workflow.userId !== userId) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });
  }

  const parsed = runStartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 }
    );
  }

  const { scope, selectedNodeIds = [], manualValues = {} } = parsed.data;

  // Concurrency guard — prevent starting a run if one is already in progress.
  // Exception: if the stuck run is older than maxDuration + 30s buffer it was
  // never cleaned up (e.g. worker killed mid-run), so auto-fail it and proceed.
  const STALE_RUN_MS = 330_000; // workflow.execute maxDuration(300s) + 30s buffer

  const activeRun = await prisma.workflowRun.findFirst({
    where:   { workflowId: params.id, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
  });

  if (activeRun) {
    const runAge = Date.now() - activeRun.startedAt.getTime();
    if (runAge > STALE_RUN_MS) {
      await prisma.workflowRun.update({
        where: { id: activeRun.id },
        data:  {
          status:       "FAILED",
          finishedAt:   new Date(),
          errorSummary: "Auto-failed: run exceeded maximum duration without completing.",
        },
      });
      // Fall through to start a fresh run
    } else {
      return NextResponse.json(
        {
          error: {
            code:          "RUN_IN_PROGRESS",
            message:       "A run is already in progress for this workflow.",
            existingRunId: activeRun.id,
            triggerRunId:  activeRun.triggerRunId,
          },
        },
        { status: 409 }
      );
    }
  }

  // Validate graph
  const graphErrors = validateGraph(workflow.nodes as any, workflow.edges as any);
  if (graphErrors.length > 0) {
    return NextResponse.json(
      { error: { code: "INVALID_GRAPH", details: graphErrors } },
      { status: 422 }
    );
  }

  // Create WorkflowRun row
  const workflowRun = await prisma.workflowRun.create({
    data: {
      workflowId:     params.id,
      userId,
      scope:          scope as any,
      status:         "RUNNING",
      selectedNodeIds,
    },
  });

  // Build snapshot (nodes + edges at time of run)
  const snapshot = { nodes: workflow.nodes, edges: workflow.edges };

  // Dispatch orchestrator task
  let triggerHandle: any;
  try {
    triggerHandle = await tasks.trigger(
      "workflow.execute",
      {
        runId:              workflowRun.id,
        workflowId:         params.id,
        scope,
        selectedNodeIds,
        snapshot,
        manualValues,
        preResolvedOutputs: {},
      },
      { tags: [runTag(workflowRun.id)] }
    );
  } catch (err) {
    // Clean up if trigger fails
    await prisma.workflowRun.update({
      where: { id: workflowRun.id },
      data:  { status: "FAILED", errorSummary: String(err) },
    });
    return NextResponse.json(
      { error: { code: "TRIGGER_FAILED", message: String(err) } },
      { status: 500 }
    );
  }

  // Update row with triggerRunId
  await prisma.workflowRun.update({
    where: { id: workflowRun.id },
    data:  { triggerRunId: triggerHandle.id },
  });

  // Mint a Public Access Token scoped to this run's tag.
  // Returns null if minting fails — client disables realtime subscription gracefully.
  let publicAccessToken: string | null = null;
  try {
    const { auth: triggerAuth } = await import("@trigger.dev/sdk/v3");
    publicAccessToken = await triggerAuth.createPublicToken({
      scopes:         { read: { tags: [runTag(workflowRun.id)] } },
      expirationTime: "30m",
    });
  } catch (e) {
    console.warn("[NextFlow] Could not mint PAT — realtime updates disabled for this run:", e);
  }

  return NextResponse.json({
    runId:             workflowRun.id,
    triggerRunId:      triggerHandle.id,
    publicAccessToken,
  });
}
