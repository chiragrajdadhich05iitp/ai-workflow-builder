// lib/executor/validateGraph.ts
// Graph-shape invariant validator (runs server-side before persisting)

import type { CanvasNode, CanvasEdge } from "@/lib/nodes/types";
import { NODE_REGISTRY, getNodeHandles } from "@/lib/nodes/registry";
import { wouldCreateCycle } from "./detectCycle";

export interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export function validateGraph(
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  // (1) request_inputs and response must exist exactly once with canonical ids
  const reqInputs = nodes.filter((n) => n.type === "request_inputs");
  const response  = nodes.filter((n) => n.type === "response");

  if (reqInputs.length !== 1 || reqInputs[0].id !== "n_request_inputs") {
    errors.push({ code: "MISSING_REQUEST_INPUTS", message: "Workflow must have exactly one request_inputs node with id 'n_request_inputs'" });
  }
  if (response.length !== 1 || response[0].id !== "n_response") {
    errors.push({ code: "MISSING_RESPONSE", message: "Workflow must have exactly one response node with id 'n_response'" });
  }

  // Build a map of nodeId → node for fast lookup
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Track target handle in-degree for single-connect enforcement
  const targetHandleCounts = new Map<string, number>();

  for (const edge of edges) {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);

    // (2) every edge endpoint resolves to a real node
    if (!srcNode) {
      errors.push({ code: "DANGLING_EDGE", message: `Edge ${edge.id}: source node '${edge.source}' not found`, edgeId: edge.id });
      continue;
    }
    if (!tgtNode) {
      errors.push({ code: "DANGLING_EDGE", message: `Edge ${edge.id}: target node '${edge.target}' not found`, edgeId: edge.id });
      continue;
    }

    // (3) source/target handle kind must match (unless target is "any")
    const srcSpec   = NODE_REGISTRY[srcNode.type as keyof typeof NODE_REGISTRY];
    const tgtSpec   = NODE_REGISTRY[tgtNode.type as keyof typeof NODE_REGISTRY];
    const srcHandles = srcSpec ? getNodeHandles(srcSpec, srcNode.data) : [];
    const tgtHandles = tgtSpec ? getNodeHandles(tgtSpec, tgtNode.data) : [];
    const srcHandle  = srcHandles.find((h) => h.id === edge.sourceHandle);
    const tgtHandle  = tgtHandles.find((h) => h.id === edge.targetHandle);

    if (srcHandle && tgtHandle && tgtHandle.kind !== "any") {
      if (srcHandle.kind !== tgtHandle.kind) {
        errors.push({
          code:    "TYPE_MISMATCH",
          message: `Edge ${edge.id}: source kind '${srcHandle.kind}' ≠ target kind '${tgtHandle.kind}'`,
          edgeId:  edge.id,
        });
      }
    }

    // (4) single-connect target handles can only have one inbound edge (vision__in exempt)
    if (tgtHandle && !tgtHandle.multi) {
      const key = `${edge.target}::${edge.targetHandle}`;
      targetHandleCounts.set(key, (targetHandleCounts.get(key) ?? 0) + 1);
      if ((targetHandleCounts.get(key) ?? 0) > 1) {
        errors.push({
          code:    "MULTI_CONNECT_VIOLATION",
          message: `Handle '${edge.targetHandle}' on node '${edge.target}' does not support multiple connections`,
          edgeId:  edge.id,
        });
      }
    }
  }

  // (5) no cycles
  if (edges.length > 0) {
    // We check the full graph for cycles by running DFS once
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    }
    const visited = new Set<string>();
    const stack   = new Set<string>();
    const dfs = (node: string): boolean => {
      if (stack.has(node)) return true;
      if (visited.has(node)) return false;
      visited.add(node); stack.add(node);
      for (const nb of adj.get(node) ?? []) { if (dfs(nb)) return true; }
      stack.delete(node);
      return false;
    };
    for (const node of nodes) {
      if (dfs(node.id)) {
        errors.push({ code: "CYCLE_DETECTED", message: "Workflow graph contains a cycle", nodeId: node.id });
        break;
      }
    }
  }

  return errors;
}
