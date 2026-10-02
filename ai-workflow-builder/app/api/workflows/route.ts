// app/api/workflows/route.ts
// GET /api/workflows  — list user's workflows
// POST /api/workflows — create new workflow

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { UNTITLED_WORKFLOW_BASE } from "@/lib/constants";

const createBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
});

// Auto-number "Untitled Workflow", "Untitled Workflow 2", "Untitled Workflow 3", …
async function nextUntitledName(userId: string): Promise<string> {
  const existing = await prisma.workflow.findMany({
    where:  { userId },
    select: { name: true },
  });
  const pattern = /^Untitled Workflow( (\d+))?$/;
  const numbers = existing
    .map((w) => w.name.match(pattern))
    .filter(Boolean)
    .map((m) => (m![2] ? parseInt(m![2], 10) : 1));

  if (numbers.length === 0) return UNTITLED_WORKFLOW_BASE ?? "Untitled Workflow";
  const max = Math.max(...numbers);
  return `${UNTITLED_WORKFLOW_BASE ?? "Untitled Workflow"} ${max + 1}`;
}

// ── GET /api/workflows ────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflows = await prisma.workflow.findMany({
    where:   { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id:        true,
      name:      true,
      updatedAt: true,
      runs: {
        orderBy: { startedAt: "desc" },
        take:    1,
        select:  { id: true, status: true, finishedAt: true },
      },
    },
  });

  return NextResponse.json({
    workflows: workflows.map((w) => ({
      id:        w.id,
      name:      w.name,
      updatedAt: w.updatedAt,
      latestRun: w.runs[0] ?? null,
    })),
  });
}

// ── POST /api/workflows ───────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }

  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 }
    );
  }

  const name = parsed.data.name ?? (await nextUntitledName(userId));

  // Seed with pre-placed nodes (JSON.stringify for SQLite compatibility)
  const nodes = [
    { id: "n_request_inputs", type: "request_inputs", position: { x: 80,   y: 420 }, data: { fields: [] } },
    { id: "n_response",       type: "response",       position: { x: 1400, y: 420 }, data: { label: "gemini_3_1_pro", result: null } },
  ];

  const workflow = await prisma.workflow.create({
    data: {
      userId,
      name,
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify([]),
    },
  });

  return NextResponse.json({ id: workflow.id }, { status: 201 });
}