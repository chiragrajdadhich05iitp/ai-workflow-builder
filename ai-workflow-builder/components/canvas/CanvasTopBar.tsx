"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock, Play, PanelLeft, FileText, CreditCard, Download, Upload } from "lucide-react";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import { canvasNodeSchema, canvasEdgeSchema } from "@/lib/nodes/schema";
import { z } from "zod";

export function CanvasTopBar() {
  const router = useRouter();
  const {
    workflowName, setWorkflowName,
    toggleHistory, historyOpen,
    toggleSidebar, sidebarCollapsed,
    startRun, activeRunId,
    selectedNodeIds,
    nodes, edges,
    importGraph,
  } = useWorkflowStore();

  const importRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function handleExport() {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflowName.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const parsedNodes = z.array(canvasNodeSchema).parse(parsed.nodes ?? []);
        const parsedEdges = z.array(canvasEdgeSchema).parse(parsed.edges ?? []);
        importGraph(parsedNodes as any, parsedEdges as any);
      } catch {
        setImportError("Invalid workflow JSON");
      }
    };
    reader.readAsText(file);
  }

  const [editingName,  setEditingName]  = useState(false);
  const [nameDraft,    setNameDraft]    = useState(workflowName);
  const [running,      setRunning]      = useState(false);
  const [runError,     setRunError]     = useState<string | null>(null);
  const [navigating,   setNavigating]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pre-warm the dashboard route so back navigation feels instant
  useEffect(() => { router.prefetch("/dashboard"); }, []);

  function handleNameSubmit() {
    if (nameDraft.trim()) setWorkflowName(nameDraft.trim());
    setEditingName(false);
  }

  async function handleRun(scope: "FULL" | "PARTIAL" | "SINGLE") {
    setRunning(true);
    setRunError(null);
    try {
      await startRun(scope, scope === "FULL" ? [] : selectedNodeIds);
    } catch (e: any) {
      setRunError(e?.message ?? "Run failed");
    } finally {
      setRunning(false);
    }
  }

  const hasSelection = selectedNodeIds.length > 0;
  const isRunning = running || !!activeRunId;

  return (
    <div className="absolute top-0 left-0 right-0 z-30 h-12 flex items-center px-3 gap-2 pointer-events-none">
      {/* Left group */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Panel toggle */}
        <button
          onClick={() => toggleSidebar()}
          className={`flex items-center justify-center w-9 h-9 rounded-xl shadow-sm transition-colors border ${
            !sidebarCollapsed
              ? "bg-purple-50 border-purple-200 text-purple-600"
              : "bg-white border-gray-200/60 hover:bg-gray-50 text-gray-600"
          }`}
        >
          <PanelLeft size={15} />
        </button>

        {/* Back + workflow name pill */}
        <div className="flex items-center bg-white rounded-xl shadow-sm border border-gray-200/60 h-9 px-1 gap-1">
          <button
            onClick={() => { setNavigating(true); router.push("/dashboard"); }}
            className={`flex items-center justify-center w-7 h-7 hover:bg-gray-100 rounded-lg transition-colors ${navigating ? "opacity-50" : ""}`}
            disabled={navigating}
          >
            <ChevronLeft size={15} className="text-gray-600" />
          </button>

          {editingName ? (
            <input
              ref={inputRef}
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter")  handleNameSubmit();
                if (e.key === "Escape") { setNameDraft(workflowName); setEditingName(false); }
              }}
              className="bg-transparent border-none text-sm text-gray-900 focus:outline-none w-40 pr-2"
            />
          ) : (
            <button
              className="text-sm font-medium text-gray-800 hover:text-gray-900 transition-colors max-w-[220px] truncate pr-2"
              onDoubleClick={() => { setNameDraft(workflowName); setEditingName(true); }}
              title="Double-click to rename"
            >
              {workflowName}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1" />

      {/* Right group */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Hidden file input for import */}
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />

        {/* Run error */}
        {runError && (
          <span className="text-xs text-red-600 bg-white border border-red-200 rounded-xl px-3 py-1 shadow-sm max-w-xs truncate">
            {runError}
          </span>
        )}

        {/* Import error */}
        {importError && (
          <span className="text-xs text-red-600 bg-white border border-red-200 rounded-xl px-3 py-1 shadow-sm max-w-xs truncate">
            {importError}
          </span>
        )}

        {/* Est chip */}
        <div className="hidden md:flex items-center gap-1.5 bg-white rounded-xl shadow-sm border border-gray-200/60 h-9 px-3 text-xs text-gray-600">
          <FileText size={13} className="text-gray-400" />
          <span>Est <span className="font-medium text-gray-800">0.83</span> M</span>
        </div>

        {/* Bal chip */}
        <div className="hidden md:flex items-center gap-1.5 bg-white rounded-xl shadow-sm border border-gray-200/60 h-9 px-3 text-xs text-gray-600">
          <CreditCard size={13} className="text-gray-400" />
          <span>Bal <span className="font-medium text-gray-800">0.00</span> M</span>
        </div>

        {/* Export */}
        <button
          onClick={handleExport}
          className="flex items-center justify-center w-9 h-9 rounded-xl shadow-sm border border-gray-200/60 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
          title="Export workflow JSON"
        >
          <Download size={14} />
        </button>

        {/* Import */}
        <button
          onClick={() => importRef.current?.click()}
          className="flex items-center justify-center w-9 h-9 rounded-xl shadow-sm border border-gray-200/60 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
          title="Import workflow JSON"
        >
          <Upload size={14} />
        </button>

        {/* Run selected (shown only when nodes selected) */}
        {hasSelection && (
          <button
            onClick={() => handleRun(selectedNodeIds.length === 1 ? "SINGLE" : "PARTIAL")}
            disabled={isRunning}
            className="flex items-center gap-1.5 h-9 px-3 bg-white rounded-xl shadow-sm border border-gray-200/60 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Play size={12} className="text-gray-600" />
            {selectedNodeIds.length === 1 ? "Run Node" : "Run Selected"}
          </button>
        )}

        {/* Run All — purple play button */}
        <button
          onClick={() => handleRun("FULL")}
          disabled={isRunning}
          className="flex items-center justify-center w-9 h-9 bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm transition-colors disabled:opacity-60"
          title={isRunning ? "Running…" : "Run All"}
        >
          <Play size={14} className="text-white fill-white" />
        </button>

        {/* History toggle */}
        <button
          onClick={() => toggleHistory()}
          className={`flex items-center justify-center w-9 h-9 rounded-xl shadow-sm border border-gray-200/60 transition-colors ${
            historyOpen
              ? "bg-purple-50 border-purple-200 text-purple-600"
              : "bg-white hover:bg-gray-50 text-gray-600"
          }`}
        >
          <Clock size={14} />
        </button>
      </div>
    </div>
  );
}
