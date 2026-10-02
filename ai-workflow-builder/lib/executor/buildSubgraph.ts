// lib/executor/buildSubgraph.ts
// Computes the subgraph of nodes/edges that need to run for a given scope

import type { CanvasNode, CanvasEdge } from "@/lib/nodes/types";

export interface Subgraph {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  /** The "target" nodes we want outputs from (leaves or selected nodes) */
  targetNodeIds: string[];
}

/**
 * FULL scope — response node is the target; everything it transitively depends on is included.
 */
export function buildFullSubgraph(
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): Subgraph {
  const responseNode = nodes.find((n) => n.id === "n_response");
  if (!responseNode) {
    return { nodes, edges, targetNodeIds: nodes.map((n) => n.id) };
  }
  const { includedIds } = collectUpstream(["n_response"], edges, nodes);
  return {
    nodes: nodes.filter((n) => includedIds.has(n.id)),
    edges: edges.filter((e) => includedIds.has(e.source) && includedIds.has(e.target)),
    targetNodeIds: ["n_response"],
  };
}

/**
 * PARTIAL / SINGLE scope — selected nodes are the targets; upstream dependencies included.
 */
export function buildPartialSubgraph(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  selectedNodeIds: string[]
): Subgraph {
  const { includedIds } = collectUpstream(selectedNodeIds, edges, nodes);
  return {
    nodes: nodes.filter((n) => includedIds.has(n.id)),
    edges: edges.filter((e) => includedIds.has(e.source) && includedIds.has(e.target)),
    targetNodeIds: selectedNodeIds,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function collectUpstream(
  startIds: string[],
  edges: CanvasEdge[],
  _nodes: CanvasNode[]
): { includedIds: Set<string> } {
  // Build reverse adjacency (target → sources)
  const revAdj: Map<string, string[]> = new Map();
  for (const e of edges) {
    if (!revAdj.has(e.target)) revAdj.set(e.target, []);
    revAdj.get(e.target)!.push(e.source);
  }

  const visited = new Set<string>();
  const queue   = [...startIds];
  while (queue.length) {
    const id = queue.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const src of revAdj.get(id) ?? []) {
      queue.push(src);
    }
  }
  return { includedIds: visited };
}
