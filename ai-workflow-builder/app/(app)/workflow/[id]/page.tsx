import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { WorkflowEditor } from "@/components/canvas/WorkflowEditor";

interface PageProps {
  params: { id: string };
}

export default async function WorkflowPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  const workflow = await prisma.workflow.findUnique({
    where: { id: params.id },
  });

  if (!workflow || workflow.userId !== userId) {
    redirect("/dashboard");
  }

  const nodes =
    typeof workflow.nodes === "string"
      ? JSON.parse(workflow.nodes)
      : workflow.nodes;

  const edges =
    typeof workflow.edges === "string"
      ? JSON.parse(workflow.edges)
      : workflow.edges;

  return (
    <WorkflowEditor
      initial={{
        id: workflow.id,
        name: workflow.name,
        nodes: nodes || [],
        edges: edges || [],
      }}
    />
  );
}
