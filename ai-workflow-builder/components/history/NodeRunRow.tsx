"use client";

import { formatDistanceToNow } from "date-fns";
import type { NodeRunDetail } from "@/lib/nodes/types";
import { Badge } from "@/components/ui/Badge";
import type { BadgeVariant } from "@/components/ui/Badge";

const NODE_TYPE_LABELS: Record<string, string> = {
  request_inputs: "Request Inputs",
  crop_image:     "Crop Image",
  gemini:         "Gemini",
  response:       "Response",
};

function nodeStatusVariant(s: string): BadgeVariant {
  switch (s) {
    case "SUCCESS": return "success";
    case "FAILED":  return "failed";
    case "RUNNING": return "running";
    case "SKIPPED": return "default";
    default:        return "default";
  }
}

export function NodeRunRow({ nr }: { nr: NodeRunDetail }) {
  const label = NODE_TYPE_LABELS[nr.nodeType] ?? nr.nodeType;

  return (
    <div className="pl-6 py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-start gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-700 font-medium">{label}</span>
            <Badge variant={nodeStatusVariant(nr.status)} className="text-[10px] py-0">
              {nr.status}
            </Badge>
            {nr.durationMs != null && (
              <span className="text-[10px] text-gray-400">{(nr.durationMs / 1000).toFixed(1)}s</span>
            )}
          </div>

          {/* Output preview */}
          {nr.output && nr.status === "SUCCESS" && (
            <div className="mt-1">
              {Object.entries(nr.output).map(([k, v]) => (
                <div key={k} className="text-[10px] text-gray-500 truncate">
                  <span className="text-gray-400">{k}:</span>{" "}
                  {typeof v === "string" && v.startsWith("http")
                    ? <a href={v} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{v.slice(0, 50)}…</a>
                    : <span className="text-gray-500">{String(v).slice(0, 80)}</span>
                  }
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {nr.error && (
            <p className="text-[10px] text-red-500 mt-1 truncate">{nr.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
