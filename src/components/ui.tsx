import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { IconArrowLeft, IconCheck } from "./icons";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

// Sans labels — the NYT convention: a button is mechanical chrome, not editorial voice.
const base =
  "press inline-flex w-full items-center justify-center gap-2 rounded-[var(--r-control)] border px-5 py-3.5 " +
  "font-sans text-[15px] font-semibold " +
  "min-h-[44px] " +
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100";

const variants: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-text text-bg active:bg-text-dim",
  secondary: "border-border-strong bg-bg text-text active:bg-surface-2",
  ghost: "border-transparent bg-transparent text-text-dim active:bg-surface-2",
  danger: "border-transparent bg-transparent text-bad active:bg-bad/10",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[var(--r-card)] border border-border border-t-2 border-t-border-strong bg-surface p-5 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * The recurring uppercase eyebrow that heads a list section, now under a 2px
 * rule — the broadsheet's section divider (SPEC §4.6/4.7/4.9/4.10).
 */
export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`border-b-2 border-border-strong pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Progress dots — filled / hollow rings drawn in CSS, not `●`/`○` glyphs.
 * Colour comes from the surrounding text colour.
 */
export function Dots({ filled, total }: { filled: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-[3px] align-[-0.05em]">
      {Array.from({ length: total }, (_, i) => (
        <i
          key={i}
          className={`block h-[7px] w-[7px] rounded-full border-[1.5px] border-current ${
            i < filled ? "bg-current" : "bg-transparent"
          }`}
        />
      ))}
    </span>
  );
}

export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto flex min-h-full w-full max-w-md flex-col ${className}`}>{children}</div>
  );
}

export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-5 pt-6 pb-4">
      <h1 className="font-serif text-[26px] font-bold tracking-[-0.005em]">{children}</h1>
      {right ? <span className="text-sm text-text-faint">{right}</span> : null}
    </div>
  );
}

/**
 * Back arrow + serif title, for the pushed screens (add / setup / calendar /
 * word detail). One header treatment so every title is set in Newsreader, not
 * bold sans. Owns no horizontal padding — the parent screen sets it.
 */
export function BackTitle({
  children,
  onBack,
  href = "/",
  right,
}: {
  children: ReactNode;
  onBack?: () => void;
  href?: string;
  right?: ReactNode;
}) {
  const arrow = "press -ml-2 flex h-10 w-10 shrink-0 items-center justify-center text-xl text-text-dim";
  return (
    <div className="flex items-center gap-1.5 pb-4">
      {onBack ? (
        <button type="button" aria-label="Back" onClick={onBack} className={arrow}>
          <IconArrowLeft />
        </button>
      ) : (
        <Link href={href} aria-label="Back" className={arrow}>
          <IconArrowLeft />
        </Link>
      )}
      <h1 className="font-serif text-[22px] font-bold tracking-[-0.005em]">{children}</h1>
      {right ? <span className="ml-auto text-sm text-text-faint">{right}</span> : null}
    </div>
  );
}

/**
 * The streak, drawn as tally strokes you're filling in — groups of five, the
 * fifth stroke crossing the group. Height scales with the caller's font-size.
 */
export function Tally({ count, className = "" }: { count: number; className?: string }) {
  const n = Math.max(0, Math.floor(count));
  const groups: number[] = [];
  for (let left = n; left > 0; left -= 5) groups.push(Math.min(5, left));

  return (
    <span
      role="img"
      aria-label={`${n} day${n === 1 ? "" : "s"}`}
      className={`inline-flex flex-wrap items-end gap-x-2 gap-y-1.5 ${className}`}
    >
      {groups.length === 0 ? (
        <span className="text-text-faint">—</span>
      ) : (
        groups.map((g, i) => (
          <span key={i} className="relative inline-flex items-end gap-[3px]">
            {Array.from({ length: g }, (_, j) => (
              <i
                key={j}
                style={{ height: "1.5em" }}
                className={`block w-[2px] rounded-[1px] ${g === 5 ? "bg-text" : "bg-text-dim"}`}
              />
            ))}
            {g === 5 && (
              <i
                aria-hidden
                className="absolute inset-x-[-3px] top-1/2 h-[2px] -translate-y-1/2 rotate-[-18deg] rounded-[1px] bg-accent"
              />
            )}
          </span>
        ))
      )}
    </span>
  );
}

export function LevelDots({ level, streak }: { level: number; streak: number }) {
  const target = ({ 1: 2, 2: 2, 3: 3, 4: 3 } as Record<number, number>)[level] ?? 3;
  if (level >= 5)
    return (
      <span className="inline-flex items-center gap-1.5 text-good">
        <IconCheck /> Finished
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2 text-text-dim">
      <span>Level {level}</span>
      <span className="text-text">
        <Dots filled={streak} total={target} />
      </span>
    </span>
  );
}
