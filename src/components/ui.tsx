import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

// Serif labels — buttons read as calls to action, not app chrome (see the visual direction).
const base =
  "press inline-flex w-full items-center justify-center gap-2 rounded-[14px] border px-5 py-4 " +
  "font-serif text-[17px] font-medium tracking-[-0.005em] " +
  "[transition-timing-function:var(--spring)] " +
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100";

const variants: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-accent text-white active:bg-[#4f7fe0]",
  secondary: "edge border-border bg-surface text-text active:bg-surface-3",
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
    <div className={`edge rounded-3xl border border-border bg-surface p-5 ${className}`}>
      {children}
    </div>
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
      <h1 className="font-serif text-[26px] font-medium tracking-[-0.01em]">{children}</h1>
      {right ? <span className="text-sm text-text-faint">{right}</span> : null}
    </div>
  );
}

export function LevelDots({ level, streak }: { level: number; streak: number }) {
  const target = ({ 1: 2, 2: 2, 3: 3, 4: 3 } as Record<number, number>)[level] ?? 3;
  if (level >= 5) return <span className="text-good">✓ Finished</span>;
  return (
    <span className="inline-flex items-center gap-2 text-text-dim">
      <span>Level {level}</span>
      <span className="tracking-[0.18em] text-text">
        {Array.from({ length: target }, (_, i) => (i < streak ? "●" : "○")).join("")}
      </span>
    </span>
  );
}
