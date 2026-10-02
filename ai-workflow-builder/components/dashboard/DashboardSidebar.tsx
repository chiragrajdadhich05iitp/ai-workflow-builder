"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Zap } from "lucide-react";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { label: "Workflows", href: "/dashboard", icon: LayoutDashboard },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-purple-600 flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-gray-900 font-semibold text-sm">NextFlow</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
              pathname === href
                ? "bg-purple-50 text-purple-700 font-medium"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 flex items-center gap-3">
<div className="flex items-center gap-2">
  <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
    U
  </div>
</div>        <span className="text-gray-500 text-xs truncate">Account</span>
      </div>
    </aside>
  );
}
