"use client";

import { useWorkflowStore } from "@/lib/store/workflowStore";

export function SaveIndicator() {
  const saveStatus = useWorkflowStore((s) => s.saveStatus);

  if (saveStatus === "idle") return null;

  const isSaved = saveStatus === "saved";

  return (
    <div
      className={`absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm border transition-all pointer-events-none ${
        isSaved
          ? "bg-green-50 border-green-200 text-green-600"
          : "bg-white border-gray-200 text-gray-500"
      }`}
    >
      {isSaved ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Saved
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block animate-pulse" />
          Saving…
        </>
      )}
    </div>
  );
}
