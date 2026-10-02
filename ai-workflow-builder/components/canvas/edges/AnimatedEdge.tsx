"use client";

import { getBezierPath, type EdgeProps } from "reactflow";

export function AnimatedEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  selected,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const color   = "#7C3AED";
  const opacity = selected ? 1 : 0.75;

  return (
    <path
      id={id}
      className="animated-edge-path"
      d={edgePath}
      stroke={color}
      strokeWidth={selected ? 2.5 : 2}
      strokeOpacity={opacity}
      fill="none"
      markerEnd={markerEnd}
      style={{ transition: "stroke-width 0.15s, stroke-opacity 0.15s" }}
    />
  );
}
