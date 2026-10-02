"use client";

import { useState } from "react";
import { type NodeProps } from "reactflow";
import { ArrowRightFromLine, Copy, Download, HelpCircle, Pencil, Check } from "lucide-react";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import { TypedHandle } from "../handles/TypedHandle";
import { Tooltip } from "@/components/ui/Tooltip";
import type { ResponseData } from "@/lib/nodes/types";
import { clsx } from "clsx";

export function ResponseNode({ id, data, selected }: NodeProps<ResponseData>) {
  const { nodeRuntime, updateNodeData } = useWorkflowStore();
  const runtime   = nodeRuntime[id];
  const isRunning = runtime?.status === "running";
  const isSuccess = runtime?.status === "success";
  const isFailed  = runtime?.status === "failed";

  const resultValue = isSuccess
    ? (runtime.output as Record<string, unknown> | undefined)?.["result__out"]
    : data.result;

  const resultStr = resultValue != null ? String(resultValue) : null;
  const showDone  = isSuccess && !!resultStr;

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft,   setLabelDraft]   = useState(data.label);

  function copyResult()     { if (resultStr) navigator.clipboard.writeText(resultStr); }
  function downloadResult() {
    if (!resultStr) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([resultStr], { type: "text/plain" }));
    a.download = "nextflow-result.txt";
    a.click();
  }
  function submitLabel() {
    if (labelDraft.trim()) updateNodeData(id, { label: labelDraft.trim() } as any);
    setEditingLabel(false);
  }

  return (
    <div
      className={clsx(
        "nf-node-card min-w-[240px] max-w-[340px] bg-white border rounded-xl overflow-hidden shadow-sm",
        selected  && "border-purple-400 ring-1 ring-purple-400",
        isRunning && "node-glow-running border-purple-400",
        showDone  && !selected && "border-emerald-400",
        isFailed  && !selected && "border-red-400",
        !selected && !isRunning && !showDone && !isFailed && "border-gray-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <div className="w-5 h-5 rounded bg-green-100 flex items-center justify-center">
          <ArrowRightFromLine size={12} className="text-green-600" />
        </div>
        <span className="text-sm font-semibold text-gray-900 flex-1">Response</span>
        {isRunning && <span className="text-xs text-purple-500 animate-pulse">Running…</span>}
        {showDone  && <span className="text-xs text-emerald-600">✓ Done</span>}
        <Tooltip content="Workflow output sink">
          <HelpCircle size={13} className="text-gray-400 hover:text-gray-600 cursor-pointer" />
        </Tooltip>
      </div>

      {/* Result handle + result item */}
      <div className="relative px-3 py-2.5 border-b border-gray-100">
        <TypedHandle
          id="result__in"
          kind="any"
          direction="in"
          label="Result (any type)"
          position={"left" as any}
          style={{ left: -5, top: "50%", transform: "translateY(-50%)" }}
        />
        <div className="pl-3">
          <div className="flex items-center gap-2 group">
            {/* Editable label */}
            {editingLabel ? (
              <input
                autoFocus
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={submitLabel}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  submitLabel();
                  if (e.key === "Escape") { setLabelDraft(data.label); setEditingLabel(false); }
                }}
                className="flex-1 text-xs text-gray-800 border-b border-purple-400 bg-transparent focus:outline-none"
              />
            ) : (
              <span className="flex-1 text-xs text-gray-700">{data.label}</span>
            )}
            <button
              onClick={() => { setLabelDraft(data.label); setEditingLabel(true); }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 transition-all p-0.5"
            >
              {editingLabel ? <Check size={10} /> : <Pencil size={10} />}
            </button>
          </div>
        </div>
      </div>

      {/* Output display */}
      <div className="p-3">
        <div className="bg-gray-50 rounded-lg min-h-[52px] p-2.5">
          {resultStr ? (
            <>
              <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-6">{resultStr}</p>
              <div className="flex items-center justify-end gap-1 mt-1.5">
                <button onClick={copyResult}     className="text-gray-400 hover:text-gray-600 p-0.5 transition-colors"><Copy     size={11} /></button>
                <button onClick={downloadResult} className="text-gray-400 hover:text-gray-600 p-0.5 transition-colors"><Download size={11} /></button>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400 text-center py-1">No output yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
