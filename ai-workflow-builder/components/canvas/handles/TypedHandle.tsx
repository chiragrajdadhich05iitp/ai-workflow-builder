"use client";

import { Handle, type HandleProps } from "reactflow";
import { getHandleColor } from "@/lib/nodes/colors";
import type { HandleKind } from "@/lib/nodes/types";
import { Tooltip } from "@/components/ui/Tooltip";

interface TypedHandleProps extends Omit<HandleProps, "type"> {
  kind: HandleKind;
  label?: string;
  direction: "in" | "out";
  connected?: boolean;
  style?: React.CSSProperties;
}

export function TypedHandle({ kind, label, direction, connected, id, style, ...rest }: TypedHandleProps) {
  const color = getHandleColor(kind);
  const rfType = direction === "in" ? "target" : "source";

  const handleEl = (
    <Handle
      {...rest}
      id={id}
      type={rfType}
      style={{
        width:       10,
        height:      10,
        borderRadius: "50%",
        background:  connected ? color : "transparent",
        border:      `2px solid ${color}`,
        boxShadow:   connected ? `0 0 6px ${color}88` : "none",
        transition:  "background 0.15s, box-shadow 0.15s",
        ...style,
      }}
    />
  );

  if (label) {
    return <Tooltip content={label}>{handleEl}</Tooltip>;
  }
  return handleEl;
}
