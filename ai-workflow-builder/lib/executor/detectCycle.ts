// lib/executor/detectCycle.ts
// DFS-based cycle detection for the workflow DAG

import type { CanvasEdge } from "@/lib/nodes/types";

/**
 * Returns true if adding candidateEdge to existingEdges would create a cycle.
 */
export function wouldCreateCycle(
  existingEdges: CanvasEdge[],
  candidateEdge: { source: string; target: string }
): boolean {
  // Build adjacency list from existing edges + candidate
  const adj: Map<string, string[]> = new Map();

  const allEdges = [
    ...existingEdges,
    { source: candidateEdge.source, target: candidateEdge.target } as CanvasEdge,
  ];

  for (const e of allEdges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }

  // DFS cycle detection
  const visited = new Set<string>();
  const stack   = new Set<string>();

  const dfs = (node: string): boolean => {
    if (stack.has(node)) return true;   // back-edge → cycle
    if (visited.has(node)) return false;
    visited.add(node);
    stack.add(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (dfs(neighbor)) return true;
    }
    stack.delete(node);
    return false;
  };

  for (const node of Array.from(adj.keys())) {
    if (dfs(node)) return true;
  }

  return false;
}
