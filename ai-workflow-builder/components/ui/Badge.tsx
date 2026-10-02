"use client";

import { clsx } from "clsx";

export type BadgeVariant = "running" | "success" | "failed" | "partial" | "cancelled" | "default";

export function Badge({ variant = "default", children, className }: {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        {
          "bg-purple-50 text-purple-700 border border-purple-200":  variant === "running",
          "bg-green-50  text-green-700  border border-green-200":   variant === "success",
          "bg-red-50    text-red-700    border border-red-200":     variant === "failed",
          "bg-yellow-50 text-yellow-700 border border-yellow-200":  variant === "partial",
          "bg-gray-100  text-gray-600   border border-gray-200":    variant === "cancelled" || variant === "default",
        },
        className
      )}
    >
      {variant === "running" && (
        <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
      )}
      {children}
    </span>
  );
}
