"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <TooltipPrimitive.Provider delayDuration={100}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className="z-50 rounded bg-[#1A1A2E] border border-[#3D3D55] px-2 py-1 text-xs text-gray-200 shadow-xl"
            sideOffset={4}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-[#1A1A2E]" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
