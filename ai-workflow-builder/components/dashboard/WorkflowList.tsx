"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { WorkflowCard } from "./WorkflowCard";
import { EmptyState } from "./EmptyState";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

interface Workflow {
  id:        string;
  name:      string;
  updatedAt: string;
  latestRun: { status: string; finishedAt: string | null } | null;
}

export function WorkflowList({ initial }: { initial: Workflow[] }) {
  const router  = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>(initial);
  const [creating,  setCreating]  = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", { method: "POST" });
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/workflow/${id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: string, name: string) {
    await fetch(`/api/workflows/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name }),
    });
    setWorkflows((ws) => ws.map((w) => w.id === id ? { ...w, name } : w));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
    setWorkflows((ws) => ws.filter((w) => w.id !== id));
    setDeleting(null);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Workflows</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {workflows.length} workflow{workflows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating}>
          <Plus size={16} />
          {creating ? "Creating…" : "New Workflow"}
        </Button>
      </div>

      {/* List */}
      {workflows.length === 0 ? (
        <EmptyState onCreate={handleCreate} />
      ) : (
        <div className="space-y-2">
          {workflows.map((wf) => (
            <WorkflowCard
              key={wf.id}
              {...wf}
              onDelete={(id) => setDeleting(id)}
              onRename={handleRename}
            />
          ))}
        </div>
      )}

      {/* Delete confirm dialog */}
      <Dialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete workflow?"
      >
        <p className="text-gray-600 text-sm mb-6">
          This will permanently delete the workflow and all its run history. This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleting && handleDelete(deleting)}>Delete</Button>
        </div>
      </Dialog>
    </div>
  );
}
