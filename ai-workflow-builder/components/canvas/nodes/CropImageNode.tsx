"use client";

import { type NodeProps } from "reactflow";
import { Crop, RotateCcw, HelpCircle, Ellipsis, Play } from "lucide-react";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import { TypedHandle } from "../handles/TypedHandle";
import { Tooltip } from "@/components/ui/Tooltip";
import type { CropImageData } from "@/lib/nodes/types";
import { clsx } from "clsx";

type ParamKey = "x" | "y" | "width" | "height";

const PARAM_LABELS: Record<ParamKey, string> = {
  x: "X Position (%)", y: "Y Position (%)", width: "Width (%)", height: "Height (%)",
};

const PARAM_DEFAULTS: Record<ParamKey, number> = {
  x: 0, y: 0, width: 100, height: 100,
};

export function CropImageNode({ id, data, selected }: NodeProps<CropImageData>) {
  const { updateNodeData, nodeRuntime, startRun } = useWorkflowStore();
  const runtime   = nodeRuntime[id];
  const isRunning = runtime?.status === "running";
  const isSuccess = runtime?.status === "success";
  const isFailed  = runtime?.status === "failed";

  function setParam(key: ParamKey, value: number) {
    const params = data.params;
    let patch = { [key]: { value } } as Record<string, any>;

    if (key === "x") {
      const maxW = 100 - value;
      if ((params.width.value ?? 100) > maxW) {
        patch.width = { value: maxW };
      }
    } else if (key === "width") {
      const maxX = 100 - value;
      if ((params.x.value ?? 0) > maxX) {
        patch.x = { value: maxX };
      }
    } else if (key === "y") {
      const maxH = 100 - value;
      if ((params.height.value ?? 100) > maxH) {
        patch.height = { value: maxH };
      }
    } else if (key === "height") {
      const maxY = 100 - value;
      if ((params.y.value ?? 0) > maxY) {
        patch.y = { value: maxY };
      }
    }

    updateNodeData(id, { params: patch } as any);
  }

  async function handleRunNode() {
    try { await startRun("SINGLE", [id]); } catch { /* handled in top bar */ }
  }

  return (
    <div
      className={clsx(
        "nf-node-card min-w-[260px] bg-white border rounded-xl overflow-hidden shadow-sm",
        selected  && "border-purple-400 ring-1 ring-purple-400",
        isRunning && "node-glow-running border-purple-400",
        isSuccess && !selected && "border-emerald-400",
        isFailed  && !selected && "border-red-400",
        !selected && !isRunning && !isSuccess && !isFailed && "border-gray-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center">
          <Crop size={12} className="text-blue-500" />
        </div>
        <span className="text-sm font-semibold text-gray-900 flex-1">Crop Image</span>
        {isRunning && <span className="text-xs text-purple-500 animate-pulse">Running…</span>}
        {isSuccess && <span className="text-xs text-emerald-600">✓</span>}
        {isFailed  && <span className="text-xs text-red-500">✗</span>}
        <Tooltip content="Crop an image by percentage bounds">
          <HelpCircle size={13} className="text-gray-400 hover:text-gray-600 cursor-pointer" />
        </Tooltip>
        <button
          onClick={handleRunNode}
          disabled={!!nodeRuntime[id]?.status && nodeRuntime[id]?.status === "running"}
          className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs px-2 py-0.5 rounded-md transition-colors"
        >
          <Play size={9} /> Run
        </button>
        <button className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors">
          <Ellipsis size={14} />
        </button>
      </div>

      {/* Input image handle + label */}
      <div className="relative px-3 py-2.5 border-b border-gray-100">
        <TypedHandle
          id="image__in"
          kind="image"
          direction="in"
          label="Input Image (required)"
          connected={data.input.image.connected}
          position={"left" as any}
          style={{ left: -5, top: "50%", transform: "translateY(-50%)" }}
        />
        <div className="flex items-center gap-2 pl-3">
          <span className="text-xs text-gray-600 flex-1">Input Image</span>
          {data.input.image.connected
            ? <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Connected</span>
            : <span className="text-xs text-red-400">*</span>
          }
        </div>
      </div>

      {/* Param sliders */}
      <div className="px-3 py-2.5 space-y-3">
        {(["x", "y", "width", "height"] as ParamKey[]).map((key) => {
          const param    = data.params[key];
          const handleId = `${key}__in`;

          return (
            <div key={key} className="relative">
              <TypedHandle
                id={handleId}
                kind="number"
                direction="in"
                label={PARAM_LABELS[key]}
                connected={param.connected}
                position={"left" as any}
                style={{ left: -5, top: "50%", transform: "translateY(-50%)" }}
              />

              <div className="pl-3 flex items-center gap-2">
                <label className="text-xs text-gray-500 w-28 flex-shrink-0">{PARAM_LABELS[key]}</label>

                {param.connected ? (
                  <span className="text-xs text-pink-500 bg-pink-50 px-1.5 py-0.5 rounded flex-1">Connected</span>
                ) : (
                  <>
                    <input
                      type="range"
                      min={0} max={100} step={1}
                      value={param.value ?? PARAM_DEFAULTS[key]}
                      onChange={(e) => setParam(key, Number(e.target.value))}
                      className="flex-1 accent-pink-500 h-1"
                    />
                    <input
                      type="number"
                      min={0} max={100}
                      value={param.value ?? PARAM_DEFAULTS[key]}
                      onChange={(e) => setParam(key, Number(e.target.value))}
                      className="w-12 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 text-center focus:outline-none focus:border-pink-400 px-1 py-0.5"
                    />
                    <button
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={() => setParam(key, PARAM_DEFAULTS[key])}
                      title="Reset"
                    >
                      <RotateCcw size={10} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Output section */}
      <div className="border-t border-gray-100">
        <div className="relative px-3 py-2.5 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">Output Image</span>
          <TypedHandle
            id="output_image__out"
            kind="image"
            direction="out"
            label="Output Image"
            position={"right" as any}
            style={{ right: -5, top: "50%", transform: "translateY(-50%)" }}
          />
        </div>

        <div className="mx-3 mb-3 bg-gray-50 rounded-lg min-h-[56px] flex items-center justify-center">
          {isSuccess && runtime?.output ? (
            <img
              src={(runtime.output as any)?.output_image__out}
              alt="Cropped"
              className="w-full rounded-lg object-cover max-h-24"
            />
          ) : isFailed && runtime?.error ? (
            <p className="text-xs text-red-500 px-2 py-2 text-center">{runtime.error}</p>
          ) : (
            <p className="text-xs text-gray-400">No output yet</p>
          )}
        </div>
      </div>

      {/* Cost indicator */}
      <div className="px-3 pb-2 flex justify-end">
        <span className="text-[10px] text-gray-400">~-0.00M ⓘ</span>
      </div>
    </div>
  );
}
