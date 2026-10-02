"use client";

import { useState, useCallback } from "react";
import { useReactFlow } from "reactflow";
import { Search, X, Image, Sparkles, Layers, ChevronRight } from "lucide-react";
import { useWorkflowStore } from "@/lib/store/workflowStore";
import type { NodeType } from "@/lib/nodes/types";

interface PickerItem {
  label:       string;
  description: string;
  nodeType:    NodeType;
}

interface PickerCategory {
  label: string;
  icon:  React.ReactNode;
  items: PickerItem[];
}

const CATEGORIES: PickerCategory[] = [
  {
    label: "AI",
    icon:  <Sparkles size={13} />,
    items: [
      {
        label:       "Gemini 3.1 Pro",
        description: "Prompt Gemini 3.1 Pro with text, images, audio or files",
        nodeType:    "gemini",
      },
    ],
  },
  {
    label: "IMAGE",
    icon:  <Image size={13} />,
    items: [
      {
        label:       "Crop Image",
        description: "Crop a region of an image using percentage coordinates",
        nodeType:    "crop_image",
      },
    ],
  },
];

export function NodePicker() {
  const { addNode, togglePicker } = useWorkflowStore();
  const { getViewport }          = useReactFlow();
  const [search, setSearch]      = useState("");

  const handleAdd = useCallback(
    (nodeType: NodeType) => {
      const vp = getViewport();
      const cx = (window.innerWidth  / 2 - vp.x) / vp.zoom;
      const cy = (window.innerHeight / 2 - vp.y) / vp.zoom;
      addNode(nodeType, { x: cx - 150, y: cy - 100 });
      togglePicker(false);
    },
    [addNode, togglePicker, getViewport]
  );

  const filteredCategories = CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter((item) =>
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) togglePicker(false);
      }}
    >
      {/* Panel */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-[560px] max-h-[580px] overflow-hidden flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            autoFocus
            placeholder="Search nodes or models."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
          />
          <button
            onClick={() => togglePicker(false)}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-md hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        {/* Category list */}
        <div className="overflow-y-auto flex-1 py-3">
          {filteredCategories.map((cat) => (
            <div key={cat.label} className="mb-1">
              {/* Category header */}
              <div className="flex items-center gap-2 px-5 py-2">
                <span className="text-gray-400">{cat.icon}</span>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {cat.label}
                </span>
              </div>

              {/* Items */}
              {cat.items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleAdd(item.nodeType)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left group"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-gray-900">{item.label}</span>
                    <span className="text-xs text-gray-400">{item.description}</span>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No results for "{search}"</p>
          )}
        </div>
      </div>
    </div>
  );
}
