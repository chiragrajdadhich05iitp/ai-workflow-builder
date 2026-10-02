"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

type ShortcutEntry = { label: string; keys: string[] };
type Section = { title: string; items: ShortcutEntry[] };

const SECTIONS: Section[] = [
  {
    title: "General",
    items: [
      { label: "Undo",               keys: ["⌘", "Z"] },
      { label: "Redo",               keys: ["⌘", "Shift", "Z"] },
      { label: "Select all",         keys: ["⌘", "A"] },
      { label: "Deselect all",       keys: ["Esc"] },
      { label: "Pan canvas",         keys: ["Space", "Drag"] },
      { label: "Zoom in",            keys: ["+"] },
      { label: "Zoom out",           keys: ["−"] },
      { label: "Fit view",           keys: ["F"] },
      { label: "Toggle select mode", keys: ["S"] },
      { label: "Auto-arrange",       keys: ["Shift", "A"] },
    ],
  },
  {
    title: "Node Operations",
    items: [
      { label: "Copy",                 keys: ["⌘", "C"] },
      { label: "Paste",                keys: ["⌘", "V"] },
      { label: "Duplicate",            keys: ["⌘", "D"] },
      { label: "Duplicate with Edges", keys: ["⌘", "Shift", "D"] },
      { label: "Delete",               keys: ["Delete"] },
    ],
  },
];

export function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <DialogPrimitive.Title className="text-lg font-bold text-gray-900">
              Keyboard Shortcuts
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-gray-500 mt-0.5">
              Quickly navigate and create with these shortcuts.
            </DialogPrimitive.Description>
          </div>

          <DialogPrimitive.Close className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 transition-colors">
            <X size={16} />
          </DialogPrimitive.Close>

          {/* Scrollable sections */}
          <div className="overflow-y-auto max-h-[60vh] px-6 py-4 space-y-6">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{section.title}</h3>
                <div className="divide-y divide-gray-100">
                  {section.items.map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-gray-700">{item.label}</span>
                      <div className="flex items-center gap-1">
                        {item.keys.map((k, i) => (
                          <kbd
                            key={i}
                            className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
