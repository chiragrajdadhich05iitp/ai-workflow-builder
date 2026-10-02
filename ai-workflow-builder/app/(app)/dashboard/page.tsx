import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { WorkflowList } from "@/components/dashboard/WorkflowList";
import { seedSampleWorkflow } from "@/prisma/seed/sampleWorkflow";

export default async function DashboardPage() {
const session = await getServerSession(authOptions);
const userId = session?.user?.id;  if (!userId) redirect("/sign-in");

  // Ensure user row exists; seed sample workflow on first-ever login.
  // findUnique + conditional create avoids a wasted write on every subsequent visit.
  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) user = await prisma.user.create({ data: { id: userId } });

  // First login: seededAt is null — seed the sample workflow (exactly once)
  if (!user.seededAt) {
    try {
      await seedSampleWorkflow(prisma, userId);
      await prisma.user.update({ where: { id: userId }, data: { seededAt: new Date() } });
    } catch (e) {
      console.error("[NextFlow] Seed failed:", e);
    }
  }

  // Load workflows
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

  const list = workflows.map((w) => ({
    id:        w.id,
    name:      w.name,
    updatedAt: w.updatedAt.toISOString(),
    latestRun: w.runs[0]
      ? { status: w.runs[0].status, finishedAt: w.runs[0].finishedAt?.toISOString() ?? null }
      : null,
  }));

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <DashboardSidebar />
      <WorkflowList initial={list} />
    </div>
  );
}
