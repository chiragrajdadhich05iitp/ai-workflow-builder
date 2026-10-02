"use client";

import React from "react";
import { clsx } from "clsx";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?:    "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed",
        {
          "bg-purple-600 hover:bg-purple-700 text-white":            variant === "primary",
          "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200": variant === "secondary",
          "hover:bg-gray-100 text-gray-600 hover:text-gray-900":     variant === "ghost",
          "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200": variant === "danger",
          "text-xs px-2.5 py-1.5":  size === "sm",
          "text-sm px-3.5 py-2":    size === "md",
          "text-base px-5 py-2.5":  size === "lg",
        },
        className
      )}
    />
  );
});
