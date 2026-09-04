"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home" },
  { href: "/words", label: "Words" },
  { href: "/stats", label: "Stats" },
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
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-1 justify-center py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                active ? "text-text" : "text-text-faint"
              }`}
            >
              {active && (
                <span className="absolute inset-x-[38%] -top-px h-0.5 bg-accent" aria-hidden />
              )}
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
