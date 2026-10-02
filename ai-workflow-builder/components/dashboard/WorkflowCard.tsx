"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, Pencil, Trash2, ExternalLink } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Badge } from "@/components/ui/Badge";
import type { BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface WorkflowCardProps {
  id:        string;
  name:      string;
  updatedAt: string;
  latestRun: { status: string; finishedAt: string | null } | null;
  onDelete:  (id: string) => void;
  onRename:  (id: string, name: string) => void;
}

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "RUNNING":   return "running";
    case "SUCCESS":   return "success";
    case "FAILED":    return "failed";
    case "PARTIAL":   return "partial";
    case "CANCELLED": return "cancelled";
    default:          return "default";
  }
}

export function WorkflowCard({
  id, name, updatedAt, latestRun, onDelete, onRename,
}: WorkflowCardProps) {
  const router   = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(name);

  function handleRenameSubmit() {
    if (draft.trim() && draft.trim() !== name) {
      onRename(id, draft.trim());
    } else {
      setDraft(name);
    }
    setEditing(false);
  }

  return (
    <div
      className="group flex items-center justify-between p-4 bg-white border border-gray-200 hover:border-gray-300 rounded-xl cursor-pointer transition-colors"
      onClick={() => !editing && router.push(`/workflow/${id}`)}
    >
      {/* Left: name + meta */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center flex-shrink-0">
          <span className="text-purple-600 text-xs font-bold">W</span>
        </div>

        <div className="min-w-0">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") { setDraft(name); setEditing(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-50 border border-purple-400 rounded px-2 py-0.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500 w-48"
            />
          ) : (
            <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
          )}
          <p className="text-xs text-gray-500 mt-0.5">
            Edited {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Right: status + actions */}
      <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {latestRun && (
          <Badge variant={statusVariant(latestRun.status)}>
            {latestRun.status}
          </Badge>
        )}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 w-7 h-7 p-0">
              <MoreHorizontal size={14} />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[140px] bg-white border border-gray-200 rounded-lg p-1 shadow-lg"
              sideOffset={4}
            >
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded cursor-pointer outline-none"
                onSelect={() => router.push(`/workflow/${id}`)}
              >
                <ExternalLink size={12} /> Open
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded cursor-pointer outline-none"
                onSelect={() => { setDraft(name); setEditing(true); }}
              >
                <Pencil size={12} /> Rename
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-gray-100 my-1" />
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded cursor-pointer outline-none"
                onSelect={() => onDelete(id)}
              >
                <Trash2 size={12} /> Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
