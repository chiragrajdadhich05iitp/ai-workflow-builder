"use client";

import { useEffect, useState, useRef } from "react";
import { RefreshCw, ChevronDown, Check } from "lucide-react";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import { RunRow } from "./RunRow";

type Tab = "ui" | "api";
type StatusFilter = "ALL" | "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED" | "CANCELLED";

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ALL",       label: "All"       },
  { value: "RUNNING",   label: "Running"   },
  { value: "SUCCESS",   label: "Completed" },
  { value: "PARTIAL",   label: "Partial"   },
  { value: "FAILED",    label: "Failed"    },
  { value: "CANCELLED", label: "Canceled"  },
];

function StatusDropdown({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selected = FILTER_OPTIONS.find((o) => o.value === value)!;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl px-3 py-1.5 hover:border-gray-300 transition-colors shadow-sm"
      >
        {selected.label}
        <ChevronDown size={13} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 transition-colors text-left"
            >
              <span className="w-4 flex-shrink-0">
                {opt.value === value && <Check size={14} className="text-gray-700" />}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HistoryPanel() {
  const {
    historyOpen, toggleHistory,
    runHistory, historyLoading, historyNextCursor,
    loadHistoryPage,
  } = useWorkflowStore();

  const [activeTab,    setActiveTab]    = useState<Tab>("ui");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  useEffect(() => {
    if (historyOpen && runHistory.length === 0) {
      loadHistoryPage(true);
    }
  }, [historyOpen]);

  const filtered = statusFilter === "ALL"
    ? runHistory
    : runHistory.filter((r) => r.status === statusFilter);

  return (
    <div className="flex-shrink-0 w-96 h-full bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <span className="text-lg font-semibold text-gray-900">Execution History</span>
        <button
          onClick={() => toggleHistory(false)}
          className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          Close
        </button>
      </div>

      {/* Tab switcher */}
      <div className="px-5 pb-4">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab("ui")}
            className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-all ${
              activeTab === "ui"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            UI Runs
          </button>
          <button
            onClick={() => setActiveTab("api")}
            className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-all ${
              activeTab === "api"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            API Runs
          </button>
        </div>
      </div>

      {activeTab === "api" ? (
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="w-full text-center text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-xl py-8">
            No runs for this filter yet.
          </div>
        </div>
      ) : (
        <>
          {/* Sub-header with custom filter dropdown */}
          <div className="flex items-center justify-between px-5 pb-3">
            <span className="text-sm font-medium text-gray-700">Run history</span>
            <StatusDropdown value={statusFilter} onChange={setStatusFilter} />
          </div>

          {/* Run list */}
          <div className="flex-1 overflow-y-auto border-t border-gray-100">
            {filtered.length === 0 && !historyLoading && (
              <div className="flex items-center justify-center px-5 py-6">
                <div className="w-full text-center text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-xl py-8">
                  No runs for this filter yet.
                </div>
              </div>
            )}

            {filtered.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}

            {historyLoading && (
              <div className="flex items-center justify-center py-4">
                <RefreshCw size={14} className="text-gray-400 animate-spin" />
              </div>
            )}

            {historyNextCursor && !historyLoading && (
              <button
                onClick={() => loadHistoryPage()}
                className="w-full text-xs text-gray-500 hover:text-gray-700 py-3 border-t border-gray-100 transition-colors"
              >
                Load more
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
