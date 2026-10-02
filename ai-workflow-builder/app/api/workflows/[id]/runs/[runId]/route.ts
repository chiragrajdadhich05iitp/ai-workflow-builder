// app/api/workflows/:id/runs/:runId
// PATCH — marks a specific RUNNING WorkflowRun as FAILED.
// Called by the client when the Trigger.dev orchestrator run hits a
// non-success terminal status (EXPIRED, TIMED_OUT, CRASHED, etc.) so that
// the user can re-run immediately without waiting for the 330 s stale-run cleanup.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string; runId: string } };

export async function PATCH(req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflow = await prisma.workflow.findUnique({ where: { id: params.id } });
  if (!workflow || workflow.userId !== userId)
    return NextResponse.json({ error: "Not Found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const { status, errorSummary } = body as { status?: unknown; errorSummary?: unknown };
  if (status !== "FAILED")
    return NextResponse.json({ error: "Only FAILED status is accepted" }, { status: 400 });

  // updateMany with status:"RUNNING" guard makes this idempotent —
  // won't overwrite a run that already completed legitimately.
  await prisma.workflowRun.updateMany({
    where: { id: params.runId, workflowId: params.id, status: "RUNNING" },
    data: {
      status:       "FAILED",
      finishedAt:   new Date(),
      errorSummary: typeof errorSummary === "string" ? errorSummary : null,
    },
  });

  return NextResponse.json({ ok: true });
}
