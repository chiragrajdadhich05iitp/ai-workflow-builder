import dagre from "@dagrejs/dagre";
import type { CanvasNode, CanvasEdge } from "@/lib/nodes/types";

const NODE_WIDTH  = 300;
const NODE_HEIGHT = 220;
const RANK_SEP    = 80;
const NODE_SEP    = 40;

export function computeAutoArrangePositions(
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", ranksep: RANK_SEP, nodesep: NODE_SEP });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    const n = g.node(node.id);
    if (n) {
      positions[node.id] = {
        x: n.x - NODE_WIDTH  / 2,
        y: n.y - NODE_HEIGHT / 2,
      };
    }
  }
  return positions;
}
