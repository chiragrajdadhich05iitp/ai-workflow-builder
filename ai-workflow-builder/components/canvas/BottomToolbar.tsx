"use client";

import { useReactFlow } from "reactflow";
import { useState, useEffect } from "react";
import {
  Undo2, Redo2, Command, ZoomIn, ZoomOut, Maximize,
  LayoutGrid, StickyNote, Plus, ChevronLeft, ChevronRight,
  Move, MousePointer2,
} from "lucide-react";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import { Tooltip } from "@/components/ui/Tooltip";
import { NodePicker } from "./NodePicker";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";
import { clsx } from "clsx";

export function BottomToolbar() {
  const { zoomIn, zoomOut, fitView, getZoom, getViewport } = useReactFlow();
  const { undo, redo, togglePicker, pickerOpen, autoArrange, addNode, canvasMode, setCanvasMode } = useWorkflowStore();
  const [currentZoom, setCurrentZoom]     = useState(100);
  const [arranging, setArranging]         = useState(false);
  const [collapsed, setCollapsed]         = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentZoom(Math.round(getZoom() * 100));
    }, 200);
    return () => clearInterval(id);
  }, [getZoom]);

  function handleAutoArrange() {
    setArranging(true);
    autoArrange();
    setTimeout(() => setArranging(false), 600);
  }

  // F = fit view, S = toggle select/pan mode (skips text inputs)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        fitView({ duration: 400 });
      }
      if (e.key === "s" || e.key === "S") {
        setCanvasMode(canvasMode === "pan" ? "select" : "pan");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fitView, canvasMode, setCanvasMode]);

  function handleAddStickyNote() {
    const vp = getViewport();
    const cx = (window.innerWidth  / 2 - vp.x) / vp.zoom;
    const cy = (window.innerHeight / 2 - vp.y) / vp.zoom;
    addNode("sticky_note", { x: cx - 96, y: cy - 72 });
  }

  return (
    <>
      {/* Main toolbar — bottom-left, collapsible */}
      <div className="absolute bottom-6 left-4 z-40 flex items-center bg-white border border-gray-200 rounded-full shadow-lg">
        {/* Collapse / expand toggle */}
        <Tooltip content={collapsed ? "Expand controls" : "Collapse controls"}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={clsx(
              "w-8 h-8 flex items-center justify-center rounded-full transition-colors m-0.5",
              "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </Tooltip>

        {/* Collapsible section */}
        {!collapsed && (
          <div className="flex items-center gap-0.5 pr-1.5">
            <ToolBtn icon={<Undo2 size={14} />}    tooltip="Undo (⌘Z)"             onClick={undo} />
            <ToolBtn icon={<Redo2 size={14} />}    tooltip="Redo (⌘⇧Z)"            onClick={redo} />
            <ToolBtn icon={<Command size={14} />}  tooltip="Keyboard shortcuts"     onClick={() => setShortcutsOpen(true)} />
            <Divider />
            <ToolBtn icon={<ZoomOut size={14} />}  tooltip="Zoom out"               onClick={() => zoomOut({ duration: 200 })} />
            <span className="text-xs text-gray-600 font-medium w-10 text-center select-none">{currentZoom}%</span>
            <ToolBtn icon={<ZoomIn size={14} />}   tooltip="Zoom in"                onClick={() => zoomIn({ duration: 200 })} />
            <Divider />
            <ToolBtn icon={<Maximize size={14} />} tooltip="Fit view (⌘⇧F)"        onClick={() => fitView({ duration: 400 })} />
            <ToolBtn
              icon={<LayoutGrid size={14} />}
              tooltip="Auto-arrange (Shift+A)"
              onClick={handleAutoArrange}
              active={arranging}
              activeClass="ring-2 ring-purple-500 bg-purple-50 text-purple-600"
            />
            {/* Pan / Select mode toggle */}
            <ToolBtn
              icon={canvasMode === "pan" ? <Move size={14} /> : <MousePointer2 size={14} />}
              tooltip={canvasMode === "pan" ? "Switch to Select mode" : "Switch to Pan mode"}
              onClick={() => setCanvasMode(canvasMode === "pan" ? "select" : "pan")}
              active={canvasMode === "select"}
              activeClass="ring-2 ring-purple-500 bg-purple-50 text-purple-600"
            />
          </div>
        )}
      </div>

      {/* Floating add buttons — bottom-center */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2 py-1.5 shadow-lg">
        <Tooltip content="Add sticky note">
          <button
            onClick={handleAddStickyNote}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <StickyNote size={14} />
          </button>
        </Tooltip>
        <Tooltip content="Add node">
          <button
            onClick={() => togglePicker()}
            className={clsx(
              "w-7 h-7 flex items-center justify-center rounded-lg transition-colors",
              pickerOpen
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            <Plus size={14} />
          </button>
        </Tooltip>
      </div>

      {/* Node picker */}
      {pickerOpen && <NodePicker />}

      {/* Keyboard shortcuts modal */}
      <KeyboardShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}

function ToolBtn({
  icon, tooltip, onClick, active, activeClass, className,
}: {
  icon:         React.ReactNode;
  tooltip:      string;
  onClick:      () => void;
  active?:      boolean;
  activeClass?: string;
  className?:   string;
}) {
  return (
    <Tooltip content={tooltip}>
      <button
        onClick={onClick}
        className={clsx(
          "w-8 h-8 flex items-center justify-center rounded-full transition-colors",
          active
            ? (activeClass ?? "bg-purple-100 text-purple-600")
            : "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
          className
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-gray-200 mx-0.5" />;
}
