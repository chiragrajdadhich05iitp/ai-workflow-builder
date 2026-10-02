"use client";

import { useEffect } from "react";
import { ReactFlowProvider } from "reactflow";
import { useWorkflowStore }     from "@/lib/store/workflowStore";
import { WorkflowCanvas }       from "./WorkflowCanvas";
import { HistoryPanel }         from "@/components/history/HistoryPanel";
import { DashboardSidebar }     from "@/components/dashboard/DashboardSidebar";
import type { CanvasNode, CanvasEdge } from "@/lib/nodes/types";

interface InitialWorkflow {
  id:      string;
  name:    string;
  version: number;
  nodes:   CanvasNode[];
  edges:   CanvasEdge[];
}

export function WorkflowEditor({ initial }: { initial: InitialWorkflow }) {
  const { historyOpen, sidebarCollapsed } = useWorkflowStore();

  useEffect(() => {
    const positionMap: Record<string, { x: number; y: number }> = {};
    for (const n of initial.nodes) {
      positionMap[n.id] = n.position;
    }
    useWorkflowStore.setState({
      workflowId:        initial.id,
      workflowName:      initial.name,
      version:           initial.version,
      nodes:             initial.nodes as any,
      edges:             initial.edges as any,
      nodePositions:     positionMap,
      nodeRuntime:       {},
      activeRunId:       null,
      triggerRunId:      null,
      publicAccessToken: null,
    });
  }, [initial.id]);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-gray-100">
        {/* Dashboard sidebar — slides in from left */}
        {!sidebarCollapsed && <DashboardSidebar />}

        {/* Canvas — top bar is absolutely positioned inside here */}
        <div className="relative flex-1 min-w-0 pt-12">
          <WorkflowCanvas />
        </div>

        {/* History panel — flex sibling so it never overlaps the top bar */}
        {historyOpen && <HistoryPanel />}
      </div>
    </ReactFlowProvider>
  );
}
