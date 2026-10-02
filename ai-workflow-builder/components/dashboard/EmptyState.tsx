"use client";

import { Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-24">
      <div className="w-20 h-20 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center">
        <Zap size={36} className="text-purple-600" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">No workflows yet</h2>
        <p className="text-gray-500 text-sm max-w-xs">
          Create your first workflow to start building LLM pipelines with images and text.
        </p>
      </div>
      <Button onClick={onCreate} size="lg">
        <Zap size={16} />
        Create New Workflow
      </Button>
    </div>
  );
}
