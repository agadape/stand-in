"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

// Chunky game buttons: a darker bottom edge that the button sinks into when pressed.
const base =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-extrabold uppercase tracking-wide transition active:translate-y-1 active:border-b-0 disabled:cursor-not-allowed disabled:active:translate-y-0";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white border-b-4 border-accent-shadow hover:brightness-105 disabled:bg-border disabled:border-border disabled:text-muted disabled:active:border-b-4",
  secondary:
    "bg-card text-blue border-2 border-b-4 border-border hover:bg-paper active:border-b-2 disabled:text-muted disabled:active:border-b-4",
  ghost: "text-muted hover:text-foreground active:translate-y-0 disabled:opacity-50",
  danger: "bg-bad text-white border-b-4 border-bad-shadow hover:brightness-105 disabled:opacity-50",
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
    <button {...props} disabled={disabled || loading} className={`${base} ${variants[variant]} ${className}`}>
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
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border-2 border-b-4 border-border bg-card p-5 ${className}`}>{children}</div>;
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
      <span className="block text-sm font-bold">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl border-2 border-border bg-paper px-4 py-3 text-base outline-none placeholder:text-muted/60 focus:border-blue";

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "gold" | "ok" | "bad" }) {
  const tones = {
    neutral: "bg-border/60 text-foreground",
    gold: "bg-gold/15 text-gold",
    ok: "bg-ok/15 text-ok",
    bad: "bg-bad/15 text-bad",
  };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${tones[tone]}`}>{children}</span>;
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
  return <p className="rounded-2xl border-2 border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{children}</p>;
}

/** A thick progress track, as on the steps of a lesson. `value` is 0..1. */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-4 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${Math.max(pct, 6)}%` }} />
    </div>
  );
}

/** Two scores on one track: the candidate's, and the bar the owner set. */
export function ScoreBar({ scoreBps, ownerBps, label }: { scoreBps: number; ownerBps: number; label: string }) {
  const score = Math.min(100, scoreBps / 100);
  const owner = Math.min(100, ownerBps / 100);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="text-3xl font-extrabold">{score.toFixed(1)}%</span>
      </div>
      <div className="relative h-4 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${score}%` }} />
        {ownerBps > 0 && (
          <div
            className="absolute top-0 h-full w-1 bg-gold"
            style={{ left: `calc(${owner}% - 2px)` }}
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

// ------------------------------------------------------------------ the look

export type Tone = "green" | "blue" | "purple" | "gold" | "pink" | "dusk";

/** One colour family per kind of page, so a page is recognisable at a glance. */
const TONES: Record<Tone, { band: string; eyebrow: string; sub: string; dot: string }> = {
  green: { band: "border-[#b6e58a] from-[#d9f7ba] to-[#f1fce4]", eyebrow: "text-accent-strong", sub: "text-foreground/70", dot: "bg-white/60" },
  blue: { band: "border-[#a6ddfb] from-[#cdeeff] to-[#ecf8ff]", eyebrow: "text-blue-shadow", sub: "text-foreground/70", dot: "bg-white/60" },
  purple: { band: "border-[#c9bdfd] from-[#e0d9ff] to-[#f4f1ff]", eyebrow: "text-[#6a56e0]", sub: "text-foreground/70", dot: "bg-white/60" },
  gold: { band: "border-[#f2d37a] from-[#ffe7a8] to-[#fff7df]", eyebrow: "text-[#a86e00]", sub: "text-foreground/70", dot: "bg-white/60" },
  pink: { band: "border-[#fbb6d0] from-[#ffd6e6] to-[#fff1f6]", eyebrow: "text-[#c93a75]", sub: "text-foreground/70", dot: "bg-white/60" },
  dusk: { band: "border-[#231d57] from-[#2a2466] to-[#5a4cc4] text-white", eyebrow: "text-white/75", sub: "text-white/85", dot: "bg-white/10" },
};

/**
 * The band at the top of a page: what the page is, in its own colour, with whatever
 * belongs beside it (usually a pet). It replaces a bare heading on a white page.
 */
export function PageHeader({
  tone = "green",
  eyebrow,
  title,
  children,
  art,
  action,
}: {
  tone?: Tone;
  eyebrow?: ReactNode;
  title: ReactNode;
  /** A sentence or two under the title. */
  children?: ReactNode;
  /** Shown on the right: a pet, an icon. Decoration, so it is hidden from screen readers. */
  art?: ReactNode;
  action?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <header className={`relative overflow-hidden rounded-3xl border-2 border-b-4 bg-gradient-to-br p-5 md:p-7 ${t.band}`}>
      <span aria-hidden className={`absolute -right-10 -top-12 size-44 rounded-full ${t.dot}`} />
      <span aria-hidden className={`absolute right-24 -bottom-16 size-32 rounded-full ${t.dot}`} />
      <div className="relative flex items-center gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          {eyebrow && <p className={`text-xs font-extrabold uppercase tracking-[0.14em] ${t.eyebrow}`}>{eyebrow}</p>}
          <h1 className="text-3xl leading-tight font-black tracking-tight md:text-4xl">{title}</h1>
          {children && <div className={`text-sm md:text-base ${t.sub}`}>{children}</div>}
          {action && <div className="pt-2">{action}</div>}
        </div>
        {art && (
          <div aria-hidden className="w-20 shrink-0 md:w-28">
            {art}
          </div>
        )}
      </div>
    </header>
  );
}

/** A section's label, with a small icon tile so sections can be told apart when scanning. */
export function SectionTitle({ icon, children, aside }: { icon?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon && (
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-card text-base">
          {icon}
        </span>
      )}
      <h2 className="min-w-0 flex-1 text-sm font-extrabold uppercase tracking-wide text-muted">{children}</h2>
      {aside}
    </div>
  );
}

/** One number with its label. */
export function Stat({ label, value, tone = "neutral" }: { label: ReactNode; value: ReactNode; tone?: "neutral" | "green" | "blue" | "gold" }) {
  const tones = {
    neutral: "border-border bg-card",
    green: "border-[#b6e58a] bg-[#f1fce4]",
    blue: "border-[#a6ddfb] bg-[#ecf8ff]",
    gold: "border-[#f2d37a] bg-[#fff7df]",
  };
  return (
    <div className={`flex flex-col-reverse rounded-2xl border-2 border-b-4 p-3 text-center ${tones[tone]}`}>
      <dt className="text-[11px] font-extrabold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-2xl font-black tabular-nums">{value}</dd>
    </div>
  );
}

/** For a list with nothing in it yet: say so kindly, and say what would fill it. */
export function EmptyState({ art, title, children }: { art?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-3xl border-2 border-dashed border-border bg-card/60 p-5">
      {art && (
        <div aria-hidden className="w-16 shrink-0">
          {art}
        </div>
      )}
      <div className="min-w-0 space-y-1">
        <p className="font-extrabold">{title}</p>
        {children && <div className="text-sm text-muted">{children}</div>}
      </div>
    </div>
  );
}
