"use client";

import { type NodeProps } from "reactflow";
import { X } from "lucide-react";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import type { StickyNoteData } from "@/lib/nodes/types";
import { useState } from "react";

export function StickyNoteNode({ id, data }: NodeProps<StickyNoteData>) {
  const { deleteNode, updateNodeData } = useWorkflowStore();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative w-48 h-36 rounded-xl shadow-sm"
      style={{ background: data.color || "#FEFCE8" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Delete button — shows on hover */}
      {hovered && (
        <button
          onClick={() => deleteNode(id)}
          className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-yellow-200/80 hover:bg-red-100 text-yellow-700 hover:text-red-500 transition-colors z-10"
        >
          <X size={10} />
        </button>
      )}

      {/* Note textarea */}
      <textarea
        className="absolute inset-0 w-full h-full bg-transparent border-none outline-none resize-none p-3 text-sm text-yellow-900 placeholder-yellow-400/70 rounded-xl"
        placeholder="Type a note..."
        value={data.text}
        onChange={(e) => updateNodeData(id, { text: e.target.value } as any)}
      />
    </div>
  );
}
