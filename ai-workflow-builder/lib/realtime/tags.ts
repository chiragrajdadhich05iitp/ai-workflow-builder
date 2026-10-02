// lib/realtime/tags.ts
// Helpers for Trigger.dev run tags — used by the orchestrator and the browser

export function runTag(runId: string): string {
  return `run:${runId}`;
}

export function nodeTag(nodeId: string): string {
  return `node:${nodeId}`;
}
