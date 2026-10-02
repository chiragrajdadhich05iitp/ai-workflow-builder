// app/api/workflows/[id]/route.ts
// GET, PATCH, DELETE

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { workflowPatchSchema } from "@/lib/nodes/schema";
import { validateGraph } from "@/lib/executor/validateGraph";

type Params = { params: { id: string } };

// ── GET /api/workflows/:id ────────────────────────────────────────────────────

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflow = await prisma.workflow.findUnique({ where: { id: params.id } });
  if (!workflow || workflow.userId !== userId) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  return NextResponse.json(workflow);
}

// ── PATCH /api/workflows/:id ──────────────────────────────────────────────────

export async function PATCH(req: Request, { params }: Params) {
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

  const parsed = workflowPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message, details: parsed.error.errors } },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Name-only patch
  if ("name" in data) {
    const updated = await prisma.workflow.update({
      where: { id: params.id },
      data:  { name: data.name },
    });
    return NextResponse.json({ version: updated.version, updatedAt: updated.updatedAt });
  }

  // Graph patch
  if ("graph" in data) {
    // Optimistic concurrency check
    if (data.version !== workflow.version) {
      return NextResponse.json(
        { error: { code: "VERSION_CONFLICT", currentVersion: workflow.version } },
        { status: 409 }
      );
    }

    // Validate graph shape
    const graphErrors = validateGraph(data.graph.nodes as any, data.graph.edges as any);
    if (graphErrors.length > 0) {
      return NextResponse.json(
        { error: { code: "INVALID_GRAPH", details: graphErrors } },
        { status: 422 }
      );
    }

    const updated = await prisma.workflow.update({
      where: { id: params.id },
      data:  {
        nodes:   data.graph.nodes as any,
        edges:   data.graph.edges as any,
        version: { increment: 1 },
      },
    });
    return NextResponse.json({ version: updated.version, updatedAt: updated.updatedAt });
  }

  return NextResponse.json({ error: { code: "INVALID_PATCH" } }, { status: 400 });
}

// ── DELETE /api/workflows/:id ─────────────────────────────────────────────────

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflow = await prisma.workflow.findUnique({ where: { id: params.id } });
  if (!workflow || workflow.userId !== userId) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  await prisma.workflow.delete({ where: { id: params.id } });
  return new Response(null, { status: 204 });
}
