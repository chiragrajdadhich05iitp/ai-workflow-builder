"use client";

import { useState, useRef } from "react";
import { type NodeProps } from "reactflow";
import { Plus, Trash2, FormInput, Image as ImageIcon, GripVertical, HelpCircle, Copy } from "lucide-react";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import { TypedHandle } from "../handles/TypedHandle";
import { Tooltip } from "@/components/ui/Tooltip";
import type { RequestInputsData, RequestInputField } from "@/lib/nodes/types";
import { clsx } from "clsx";

export function RequestInputsNode({ id, data, selected }: NodeProps<RequestInputsData>) {
  const { addField, removeField, renameField, setFieldValue, nodeRuntime } = useWorkflowStore();
  const runtime   = nodeRuntime[id];
  const isRunning = runtime?.status === "running";
  const isSuccess = runtime?.status === "success";
  const isFailed  = runtime?.status === "failed";

  return (
    <div
      className={clsx(
        "nf-node-card min-w-[260px] max-w-[320px] bg-white border rounded-xl overflow-hidden shadow-sm",
        selected  && "border-purple-400 ring-1 ring-purple-400",
        isRunning && "node-glow-running border-purple-400",
        isSuccess && !selected && "border-emerald-400",
        isFailed  && !selected && "border-red-400",
        !selected && !isRunning && !isSuccess && !isFailed && "border-gray-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <div className="w-5 h-5 rounded bg-orange-100 flex items-center justify-center">
          <FormInput size={12} className="text-orange-500" />
        </div>
        <span className="text-sm font-semibold text-gray-900 flex-1">Request-Inputs</span>
        {isRunning && <span className="text-xs text-purple-500 animate-pulse">Running…</span>}
        {isSuccess && <span className="text-xs text-emerald-600">✓</span>}
        {isFailed  && <span className="text-xs text-red-500">✗</span>}
        <Tooltip content="Input node — provides values to the workflow">
          <HelpCircle size={13} className="text-gray-400 hover:text-gray-600 cursor-pointer" />
        </Tooltip>
        <button
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          onClick={() => addField("text_field")}
          title="Add text field"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Fields */}
      <div className="divide-y divide-gray-50">
        {data.fields.length === 0 && (
          <p className="text-xs text-gray-400 px-4 py-4 text-center">
            Click <strong className="text-gray-600">+</strong> to add a field.
          </p>
        )}

        {data.fields.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            nodeId={id}
            onRemove={() => removeField(field.id)}
            onRename={(name) => renameField(field.id, name)}
            onValueChange={(val) => setFieldValue(field.id, val)}
          />
        ))}
      </div>

      {/* Add field footer */}
      {data.fields.length > 0 && (
        <div className="flex gap-1 p-2 border-t border-gray-100">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg py-1.5 transition-colors"
            onClick={() => addField("text_field")}
          >
            <Plus size={11} /> Text
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg py-1.5 transition-colors"
            onClick={() => addField("image_field")}
          >
            <Plus size={11} /> Image
          </button>
        </div>
      )}
    </div>
  );
}

// ── Individual field row ──────────────────────────────────────────────────────

function FieldRow({
  field, nodeId, onRemove, onRename, onValueChange,
}: {
  field:         RequestInputField;
  nodeId:        string;
  onRemove:      () => void;
  onRename:      (n: string) => void;
  onValueChange: (v: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft,   setNameDraft]   = useState(field.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKind = field.kind === "image_field" ? "image" : "text";

  return (
    <div className="relative group px-3 py-2.5">
      {/* Output handle on the right */}
      <TypedHandle
        id={`${field.id}__out`}
        kind={handleKind}
        direction="out"
        label={field.name}
        position={"right" as any}
        style={{ right: -5, top: "50%", transform: "translateY(-50%)" }}
      />

      {/* Field name row */}
      <div className="flex items-center gap-2 mb-1.5">
        <GripVertical size={10} className="text-gray-300 flex-shrink-0" />
        {field.kind === "image_field"
          ? <ImageIcon size={11} className="text-blue-500 flex-shrink-0" />
          : <FormInput size={11} className="text-orange-500 flex-shrink-0" />
        }

        {editingName ? (
          <input
            ref={inputRef}
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => { onRename(nameDraft || field.name); setEditingName(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter")  { onRename(nameDraft || field.name); setEditingName(false); }
              if (e.key === "Escape") { setNameDraft(field.name); setEditingName(false); }
            }}
            className="flex-1 bg-transparent border-b border-purple-400 text-xs text-gray-800 focus:outline-none"
          />
        ) : (
          <span
            className="flex-1 text-xs text-gray-700 cursor-pointer hover:text-gray-900 truncate"
            onDoubleClick={() => { setNameDraft(field.name); setEditingName(true); }}
          >
            {field.name}
          </span>
        )}

        <button
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-all p-0.5"
          onClick={() => navigator.clipboard?.writeText(field.name)}
          title="Copy field name"
        >
          <Copy size={10} />
        </button>
        <button
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-0.5"
          onClick={onRemove}
        >
          <Trash2 size={10} />
        </button>
      </div>

      {/* Value input */}
      {field.kind === "text_field" ? (
        <textarea
          className="w-full bg-gray-50 border border-gray-200 focus:border-orange-400 rounded-lg text-xs text-gray-700 px-2.5 py-1.5 resize-none focus:outline-none transition-colors placeholder-gray-400"
          rows={2}
          placeholder="Enter text..."
          value={field.value}
          onChange={(e) => onValueChange(e.target.value)}
        />
      ) : (
        <ImageFieldUpload
          value={field.value}
          onChange={onValueChange}
        />
      )}
    </div>
  );
}

// ── Image field upload widget ─────────────────────────────────────────────────

function ImageFieldUpload({ value, onChange }: { value: string | null; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const sigRes = await fetch("/api/upload/signature", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ filename: file.name, size: file.size, mimeType: file.type }),
      });
      if (!sigRes.ok) throw new Error("Failed to get upload signature");
      const { params, signature, endpoint } = await sigRes.json();

      const formData = new FormData();
      formData.append("params",    params);
      formData.append("signature", signature);
      formData.append("file",      file);

      const uploadRes  = await fetch(endpoint, { method: "POST", body: formData });
      const uploadData = await uploadRes.json();

      const assemblyUrl = uploadData.assembly_ssl_url ?? uploadData.assembly_url;
      if (!assemblyUrl) throw new Error("No assembly URL in response");

      let result = uploadData;
      while (result.ok === "ASSEMBLY_EXECUTING" || result.ok === "REQUEST_ABORTED") {
        await new Promise((r) => setTimeout(r, 1000));
        const poll = await fetch(assemblyUrl);
        result = await poll.json();
      }

      const uploads = result?.uploads?.[0] ?? result?.results?.["upload"]?.[0];
      const url     = uploads?.ssl_url ?? uploads?.url;
      if (url) onChange(url);
    } catch (err) {
      console.error("[NextFlow] Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  if (value) {
    return (
      <div className="relative rounded-lg overflow-hidden border border-gray-200 group/img">
        <img src={value} alt="Uploaded" className="w-full h-24 object-cover" />
        <button
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity text-xs text-white"
          onClick={() => onChange("")}
        >
          <Trash2 size={12} className="mr-1" /> Remove
        </button>
      </div>
    );
  }

  return (
    <label
      className={clsx(
        "flex flex-col items-center justify-center gap-1.5 w-full h-20 border-2 border-dashed rounded-lg cursor-pointer transition-colors text-xs",
        uploading
          ? "border-purple-400 text-purple-500"
          : "border-gray-200 hover:border-blue-400 text-gray-400 hover:text-gray-600"
      )}
    >
      <ImageIcon size={18} className={uploading ? "text-purple-400" : "text-gray-400"} />
      {uploading ? "Uploading…" : "Click to upload image"}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        disabled={uploading}
      />
    </label>
  );
}
