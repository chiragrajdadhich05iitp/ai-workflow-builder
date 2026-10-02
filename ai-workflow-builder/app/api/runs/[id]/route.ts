// app/api/runs/[id]/route.ts
// GET /api/runs/:id — single run with full node-level detail

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const run = await prisma.workflowRun.findUnique({
    where:   { id: params.id },
    include: { nodeRuns: { orderBy: { startedAt: "asc" } } },
  });

  // Never 403 — return 404 for both "not found" and "not yours"
  if (!run || run.userId !== userId) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  return NextResponse.json(run);
}
