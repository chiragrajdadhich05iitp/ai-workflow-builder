"use client";

import { useState } from "react";
import { type NodeProps } from "reactflow";
import { Sparkles, ChevronDown, ChevronUp, HelpCircle, Ellipsis, Play, Copy, Download } from "lucide-react";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import { TypedHandle } from "../handles/TypedHandle";
import { Tooltip } from "@/components/ui/Tooltip";
import type { GeminiData } from "@/lib/nodes/types";
import { AVAILABLE_GEMINI_MODELS } from "@/lib/constants";
import { clsx } from "clsx";

export function GeminiNode({ id, data, selected }: NodeProps<GeminiData>) {
  const { updateNodeData, nodeRuntime, startRun } = useWorkflowStore();
  const runtime   = nodeRuntime[id];
  const isRunning = runtime?.status === "running";
  const isSuccess = runtime?.status === "success";
  const isFailed  = runtime?.status === "failed";

  function update(patch: Partial<GeminiData>) {
    updateNodeData(id, patch as any);
  }

  async function handleRunNode() {
    try { await startRun("SINGLE", [id]); } catch { /* handled in top bar */ }
  }

  const responseText = isSuccess
    ? ((runtime.output as any)?.response__out as string | undefined)
    : null;

  return (
    <div
      className={clsx(
        "nf-node-card min-w-[280px] max-w-[340px] bg-white border rounded-xl overflow-hidden shadow-sm",
        selected  && "border-purple-400 ring-1 ring-purple-400",
        isRunning && "node-glow-running border-purple-400",
        isSuccess && !selected && "border-emerald-400",
        isFailed  && !selected && "border-red-400",
        !selected && !isRunning && !isSuccess && !isFailed && "border-gray-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <div className="w-5 h-5 rounded bg-purple-100 flex items-center justify-center">
          <Sparkles size={12} className="text-purple-500" />
        </div>
        <select
          className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none cursor-pointer"
          value={data.model}
          onChange={(e) => update({ model: e.target.value })}
        >
          {AVAILABLE_GEMINI_MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {isRunning && <span className="text-xs text-purple-500 animate-pulse">Running…</span>}
        {isSuccess && <span className="text-xs text-emerald-600">✓</span>}
        {isFailed  && <span className="text-xs text-red-500">✗</span>}
        <Tooltip content="Google Gemini multimodal LLM">
          <HelpCircle size={13} className="text-gray-400 hover:text-gray-600 cursor-pointer" />
        </Tooltip>
        <button
          onClick={handleRunNode}
          disabled={isRunning}
          className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs px-2 py-0.5 rounded-md transition-colors"
        >
          <Play size={9} /> Run
        </button>
        <button className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors">
          <Ellipsis size={14} />
        </button>
      </div>

      {/* Input handles */}
      <div className="divide-y divide-gray-50">
        {/* Prompt */}
        <InputRow
          handleId="prompt__in"
          kind="text"
          label="Prompt"
          required
          connected={data.prompt.connected}
          value={data.prompt.value ?? ""}
          onChange={(v) => update({ prompt: { value: v, connected: data.prompt.connected } })}
          multiline
        />

        {/* System Prompt */}
        <InputRow
          handleId="system_prompt__in"
          kind="text"
          label="System Prompt"
          connected={data.systemPrompt.connected}
          value={data.systemPrompt.value ?? ""}
          onChange={(v) => update({ systemPrompt: { value: v, connected: data.systemPrompt.connected } })}
          multiline
        />

        {/* Vision (multi-connect) */}
        <div className="relative px-3 py-2.5">
          <TypedHandle
            id="vision__in"
            kind="image"
            direction="in"
            label="Image (Vision) — multi-connect"
            position={"left" as any}
            style={{ left: -5, top: "50%", transform: "translateY(-50%)" }}
            connected={data.vision.connectedFrom.length > 0}
          />
          <div className="pl-3 flex items-center gap-2">
            <span className="text-xs text-gray-600 flex-1">Image (Vision)</span>
            {data.vision.connectedFrom.length > 0 ? (
              <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                {data.vision.connectedFrom.length} connected
              </span>
            ) : (
              <span className="text-xs text-gray-400">Optional</span>
            )}
          </div>
        </div>

        {/* Video / Audio / File */}
        <SimpleHandleRow handleId="video__in" kind="video" label="Video" connected={data.video.connected} />
        <SimpleHandleRow handleId="audio__in" kind="audio" label="Audio" connected={data.audio.connected} />
        <SimpleHandleRow handleId="file__in"  kind="file"  label="File"  connected={data.file.connected}  />

        {/* Settings collapsible */}
        <div>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-gray-800 transition-colors"
            onClick={() => update({ settingsCollapsed: !data.settingsCollapsed })}
          >
            {data.settingsCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            Settings
          </button>

          {!data.settingsCollapsed && (
            <div className="px-3 pb-3 space-y-2.5">
              {(["temperature","topP","topK","maxOutputTokens"] as const).map((key) => {
                const ranges: Record<string, [number, number, number]> = {
                  temperature:     [0, 2, 0.01],
                  topP:            [0, 1, 0.01],
                  topK:            [1, 100, 1],
                  maxOutputTokens: [1, 8192, 1],
                };
                const [min, max, step] = ranges[key];
                return (
                  <div key={key} className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-32 flex-shrink-0">{key}</label>
                    <input
                      type="range"
                      min={min} max={max} step={step}
                      value={data.settings[key]}
                      onChange={(e) => update({ settings: { ...data.settings, [key]: Number(e.target.value) } })}
                      className="flex-1 accent-purple-500 h-1"
                    />
                    <span className="text-xs text-gray-500 w-10 text-right">{data.settings[key]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Output section */}
      <div className="border-t border-gray-100">
        <div className="relative px-3 py-2.5 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">Response</span>
          <TypedHandle
            id="response__out"
            kind="text"
            direction="out"
            label="Response (text)"
            position={"right" as any}
            style={{ right: -5, top: "50%", transform: "translateY(-50%)" }}
          />
        </div>

        <div className="mx-3 mb-3 bg-gray-50 rounded-lg min-h-[48px] p-2.5">
          {responseText ? (
            <>
              <p className="text-xs text-gray-700 line-clamp-4 whitespace-pre-wrap">{responseText}</p>
              <div className="flex gap-1 mt-1.5 justify-end">
                <button onClick={() => navigator.clipboard?.writeText(responseText)} className="text-gray-400 hover:text-gray-600 p-0.5">
                  <Copy size={11} />
                </button>
                <button
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(new Blob([responseText], { type: "text/plain" }));
                    a.download = "response.txt";
                    a.click();
                  }}
                  className="text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <Download size={11} />
                </button>
              </div>
            </>
          ) : isFailed && runtime?.error ? (
            <p className="text-xs text-red-500">{runtime.error}</p>
          ) : (
            <p className="text-xs text-gray-400 text-center py-1">No output yet</p>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function InputRow({
  handleId, kind, label, required, connected, value, onChange, multiline,
}: {
  handleId:  string;
  kind:      "text" | "image";
  label:     string;
  required?: boolean;
  connected: boolean;
  value:     string;
  onChange:  (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="relative px-3 py-2.5">
      <TypedHandle
        id={handleId}
        kind={kind}
        direction="in"
        label={label}
        connected={connected}
        position={"left" as any}
        style={{ left: -5, top: multiline ? "28px" : "50%", transform: multiline ? "none" : "translateY(-50%)" }}
      />
      <div className="pl-3 space-y-1.5">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-600">{label}</span>
          {required && <span className="text-xs text-red-400">*</span>}
          {connected && <span className="text-xs text-orange-500 ml-auto">Connected</span>}
        </div>
        {!connected && (
          multiline ? (
            <textarea
              className="w-full bg-gray-50 border border-gray-200 focus:border-orange-400 rounded-lg text-xs text-gray-700 px-2.5 py-1.5 resize-none focus:outline-none transition-colors placeholder-gray-400"
              rows={2}
              placeholder={`Enter ${label.toLowerCase()}…`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <input
              className="w-full bg-gray-50 border border-gray-200 focus:border-orange-400 rounded-lg text-xs text-gray-700 px-2.5 py-1 focus:outline-none transition-colors placeholder-gray-400"
              placeholder={`Enter ${label.toLowerCase()}…`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          )
        )}
      </div>
    </div>
  );
}

function SimpleHandleRow({
  handleId, kind, label, connected,
}: {
  handleId:  string;
  kind:      "video" | "audio" | "file";
  label:     string;
  connected: boolean;
}) {
  const connectedColor =
    kind === "video" ? "text-green-600 bg-green-50" :
    kind === "audio" ? "text-cyan-600 bg-cyan-50"   :
                       "text-purple-600 bg-purple-50";

  return (
    <div className="relative px-3 py-2.5">
      <TypedHandle
        id={handleId}
        kind={kind}
        direction="in"
        label={label}
        connected={connected}
        position={"left" as any}
        style={{ left: -5, top: "50%", transform: "translateY(-50%)" }}
      />
      <div className="pl-3 flex items-center gap-2">
        <span className="text-xs text-gray-600 flex-1">{label}</span>
        {connected
          ? <span className={`text-xs px-1.5 py-0.5 rounded ${connectedColor}`}>Connected</span>
          : <span className="text-xs text-gray-400">Optional</span>
        }
      </div>
    </div>
  );
}
