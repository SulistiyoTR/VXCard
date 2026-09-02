import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white active:bg-accent/80",
  secondary: "bg-surface-2 text-text active:bg-border",
  ghost: "bg-transparent text-text-dim active:bg-surface-2",
  danger: "bg-transparent text-bad active:bg-bad/10",
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
    <div className={`rounded-3xl border border-border bg-surface p-5 ${className}`}>{children}</div>
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
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {right ? <span className="text-text-faint">{right}</span> : null}
    </div>
  );
}

export function LevelDots({ level, streak }: { level: number; streak: number }) {
  const target = ({ 1: 2, 2: 2, 3: 3, 4: 3 } as Record<number, number>)[level] ?? 3;
  if (level >= 5) return <span className="text-good">✓ Finished</span>;
  return (
    <span className="inline-flex items-center gap-2 text-text-dim">
      <span>Level {level}</span>
      <span className="tracking-widest">
        {Array.from({ length: target }, (_, i) => (i < streak ? "●" : "○")).join("")}
      </span>
    </span>
  );
}
