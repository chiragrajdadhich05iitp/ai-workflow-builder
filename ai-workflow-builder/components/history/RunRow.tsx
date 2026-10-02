"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { BadgeVariant } from "@/components/ui/Badge";
import type { RunSummary } from "@/lib/nodes/types";
import { NodeRunRow } from "./NodeRunRow";
import { useWorkflowStore } from "@/lib/store/workflowStore";

function statusVariant(s: string): BadgeVariant {
  switch (s) {
    case "RUNNING":   return "running";
    case "SUCCESS":   return "success";
    case "FAILED":    return "failed";
    case "PARTIAL":   return "partial";
    case "CANCELLED": return "cancelled";
    default:          return "default";
  }
}

export function RunRow({ run }: { run: RunSummary }) {
  const { expandedRunIds, expandRun, collapseRun, runDetails } = useWorkflowStore();
  const isExpanded = !!expandedRunIds[run.id];
  const detail     = runDetails[run.id];

  function toggle() {
    if (isExpanded) {
      collapseRun(run.id);
    } else {
      expandRun(run.id);
    }
  }

  return (
    <div className="border-b border-gray-100">
      {/* Run header row */}
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={toggle}
      >
        {isExpanded ? <ChevronDown size={12} className="text-gray-500 flex-shrink-0" /> : <ChevronRight size={12} className="text-gray-500 flex-shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusVariant(run.status)} className="text-[10px] py-0">
              {run.status}
            </Badge>
            <span className="text-xs text-gray-500 capitalize">{run.scope.toLowerCase()}</span>
            {run.durationMs != null && (
              <span className="text-[10px] text-gray-400">{(run.durationMs / 1000).toFixed(1)}s</span>
            )}
          </div>
          <p className="text-[10px] text-gray-600 mt-0.5">
            {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
          </p>
        </div>
      </button>

      {/* Expanded node runs */}
      {isExpanded && (
        <div className="bg-gray-50">
          {!detail ? (
            <p className="text-xs text-gray-500 px-6 py-3">Loading…</p>
          ) : (
            detail.nodeRuns.map((nr) => <NodeRunRow key={nr.id} nr={nr} />)
          )}
        </div>
      )}
    </div>
  );
}
