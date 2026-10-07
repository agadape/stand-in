"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong disabled:bg-accent/40",
  secondary: "bg-card text-foreground border border-border hover:border-accent disabled:opacity-50",
  ghost: "text-muted hover:text-foreground disabled:opacity-50",
  danger: "bg-bad/15 text-bad border border-bad/40 hover:bg-bad/25 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  children,
  className = "",
}: {
  href: string;
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-border bg-card p-5 ${className}`}>{children}</div>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none placeholder:text-muted/60 focus:border-accent";

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "gold" | "ok" | "bad" }) {
  const tones = {
    neutral: "bg-border/60 text-foreground",
    gold: "bg-gold/15 text-gold",
    ok: "bg-ok/15 text-ok",
    bad: "bg-bad/15 text-bad",
  };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-2xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{children}</p>;
}

/** Two scores on one track: the candidate's, and the bar the owner set. */
export function ScoreBar({ scoreBps, ownerBps, label }: { scoreBps: number; ownerBps: number; label: string }) {
  const score = Math.min(100, scoreBps / 100);
  const owner = Math.min(100, ownerBps / 100);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-3xl font-semibold">{score.toFixed(1)}%</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${score}%` }} />
        {ownerBps > 0 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-gold"
            style={{ left: `calc(${owner}% - 1px)` }}
            title={`Owner's bar: ${owner.toFixed(1)}%`}
          />
        )}
      </div>
      {ownerBps > 0 && (
        <p className="text-xs text-muted">
          <span className="text-gold">▍</span> The bar to beat: {owner.toFixed(1)}%
        </p>
      )}
    </div>
  );
}

export function Address({ value }: { value: string }) {
  return (
    <span className="font-mono text-xs text-muted">
      {value.slice(0, 6)}…{value.slice(-4)}
    </span>
  );
}
