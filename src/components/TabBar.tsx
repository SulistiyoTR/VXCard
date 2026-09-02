"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/words", label: "My words", icon: "📚" },
  { href: "/stats", label: "Stats", icon: "📊" },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-10 border-t border-border bg-bg/95 backdrop-blur safe-b">
      <div className="mx-auto flex max-w-md">
        {tabs.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs ${
                active ? "text-text" : "text-text-faint"
              }`}
            >
              <span className="text-xl">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
